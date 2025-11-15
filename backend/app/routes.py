import os
from flask import Blueprint, request, jsonify, current_app, send_file, abort
from werkzeug.utils import secure_filename
from .validation import load_schema, xsd_validate, business_rules_check
from .utils import generate_id, save_xml_and_meta, load_meta, list_metas
from lxml import etree

bp = Blueprint("api", __name__, url_prefix="/api")

SCHEMA_PATH = os.path.join(os.path.dirname(__file__), "model", "schema.xsd")
XML_SCHEMA = load_schema(SCHEMA_PATH)

def error_response(code, message, xpath=None, http_status=400):
    payload = {"code": code, "message": message}
    if xpath is not None:
        payload["xpath"] = xpath
    return jsonify(payload), http_status

@bp.route("/xml", methods=["POST"])
def post_xml():
    if 'file' in request.files:
        f = request.files['file']
        xml_bytes = f.read()
    else:
        xml_bytes = request.get_data()
    if not xml_bytes:
        return error_response("NO_CONTENT", "Nenhum XML recebido no corpo da requisicao", http_status=400)

    xsd_errors = xsd_validate(xml_bytes, XML_SCHEMA)
    if xsd_errors:
        e = xsd_errors[0]
        return jsonify(e), 400

    biz_errors, meta = business_rules_check(xml_bytes)

    for e in biz_errors:
        if e["code"].startswith("DUPLICATE"):
            return jsonify(e), 409

    if biz_errors:
        return jsonify(biz_errors[0]), 400


    data_dir = current_app.config["DATA_DIR"]
    xml_id = generate_id("leitura")
    xml_path, meta_path = save_xml_and_meta(data_dir, xml_bytes, xml_id, meta)
    return jsonify({"id": xml_id, "message": "XML valido e armazenado."}), 201

@bp.route("/xml/<string:xml_id>", methods=["GET"])
def get_xml(xml_id):
    data_dir = current_app.config["DATA_DIR"]
    xml_file = os.path.join(data_dir, f"{xml_id}.xml")
    if not os.path.exists(xml_file):
        return error_response("NOT_FOUND", "XML nao encontrado", http_status=404)
    
    accept = request.headers.get("Accept", "")
    if "application/json" in accept:
        meta = load_meta(data_dir, xml_id)
        if not meta:
            return error_response("NOT_FOUND", "Meta nao encontrada (XML talvez corrompido)", http_status=404)
        return jsonify(meta), 200
    
    return send_file(xml_file, mimetype="application/xml")

@bp.route("/consulta", methods=["GET"])
def consulta():
    """
    GET /api/consulta?tipo=&inicio=&fim=&status=&page=&per_page=
    tipo -> sensor tipo (e.g. temperatura)
    inicio/fim -> ISO date-time strings
    status -> ok|out_of_range|unknown_range
    """
    args = request.args
    tipo = args.get("tipo")
    inicio = args.get("inicio")
    fim = args.get("fim")
    status = args.get("status")
    page = int(args.get("page", 1))
    per_page = int(args.get("per_page", 20))
    
    metas = list_metas(current_app.config["DATA_DIR"])
    results = []
    from dateutil import parser as dtparser
    def in_range(dt_str, start, end):
        if not dt_str:
            return False
        dt = dtparser.parse(dt_str)
        if start and dt < start: return False
        if end and dt > end: return False
        return True
    start_dt = dtparser.parse(inicio) if inicio else None
    end_dt = dtparser.parse(fim) if fim else None
    for m in metas:
        
        for l in m["leituras"]:
            
            sensor_ref = l.get("sensorRef")
            sensor_tipo = m["sensors"].get(sensor_ref)
            if tipo and sensor_tipo != tipo:
                continue
            if status and l.get("status") != status:
                continue
            if not in_range(l.get("dataHora"), start_dt, end_dt):
                continue
            
            entry = {
                "source_id": m.get("source_id") or None,  
                "estufa": m.get("estufa"),
                "localizacao": m.get("localizacao"),
                "sensorRef": sensor_ref,
                "tipo": sensor_tipo,
                "dataHora": l.get("dataHora"),
                "valor": l.get("valor"),
                "status": l.get("status"),
                "xpath": l.get("xpath")
            }
           
            results.append(entry)
    
    total = len(results)
    start = (page - 1) * per_page
    end = start + per_page
    page_items = results[start:end]
    return jsonify({
        "total": total,
        "page": page,
        "per_page": per_page,
        "items": page_items
    })
