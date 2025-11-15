from lxml import etree
from datetime import datetime
from dateutil import parser as dtparser

# Range rules for each sensor tipo
RANGES = {
    "temperatura": (-10, 60),      # °C
    "umidadeAr": (0, 100),         # %
    "umidadeSolo": (0, 100),       # %
    "co2": (0, 10000),             # ppm
    "luminosidade": (0, 200000),   # lux
}

def load_schema(schema_path):
    with open(schema_path, "rb") as f:
        schema_doc = etree.parse(f)
    return etree.XMLSchema(schema_doc)

def xsd_validate(xml_bytes, schema):
    """
    Returns list of validation error dicts (empty if none).
    Each error: {"code": "XSD_VALIDATION_ERROR", "message": "...", "xpath": "..."}
    """
    parser = etree.XMLParser(ns_clean=True, remove_blank_text=True, recover=False)
    try:
        doc = etree.fromstring(xml_bytes, parser)
    except etree.XMLSyntaxError as e:
        # syntax error not necessarily XSD - map to message and no xpath
        return [{"code": "XML_SYNTAX_ERROR", "message": str(e), "xpath": None}]
    # validate
    ok = schema.validate(doc)
    if ok:
        return []
    errors = []
    for err in schema.error_log:
        # err.line, message, domain_name, type_name; we can try to resolve element to xpath
        # lxml's error_log doesn't include exact xpath; we'll present line or None.
        # Provide approximate xpath using element position if available (not always available).
        errors.append({
            "code": "XSD_VALIDATION_ERROR",
            "message": err.message,
            "xpath": f"line:{err.line}" if err.line is not None else None
        })
    return errors

def business_rules_check(xml_bytes):
    """
    Check:
     - uniqueness of sensor/@id
     - ranges for cada leitura valor according to sensor tipo (lookup via sensor id)
     - integridade ID/IDREF: ensure sensorRef ref exists
    Returns list of errors similar to xsd_validate (error dicts).
    Also returns metadata for storage (list of readings with status).
    """
    parser = etree.XMLParser(ns_clean=True, remove_blank_text=True)
    doc = etree.fromstring(xml_bytes, parser)
    errors = []
    # map sensors id -> tipo
    sensors = {}
    for s in doc.xpath("/estufa/sensores/sensor"):
        sid = s.get("id")
        if sid in sensors:
            errors.append({"code": "DUPLICATE_SENSOR_ID", "message": f"Sensor id duplicado '{sid}'", "xpath": f"/estufa/sensores/sensor[@id='{sid}']"})
        tipo_el = s.find("tipo")
        tipo = tipo_el.text if tipo_el is not None else None
        sensors[sid] = tipo

    # check leituras
    leituras = []
    for idx, l in enumerate(doc.xpath("/estufa/leituras/leitura"), start=1):
        # xpath base for this leitura
        base_xpath = f"/estufa/leituras/leitura[{idx}]"
        # dataHora
        dataHora_el = l.find("dataHora")
        if dataHora_el is None:
            errors.append({"code": "MISSING_FIELD", "message": "dataHora ausente", "xpath": base_xpath + "/dataHora"})
            dataHora = None
        else:
            try:
                dataHora = dtparser.parse(dataHora_el.text)
            except Exception as e:
                errors.append({"code": "INVALID_DATETIME", "message": f"dataHora inválida: {e}", "xpath": base_xpath + "/dataHora"})
                dataHora = None
        # sensorRef
        sensorRef_el = l.find("sensorRef")
        if sensorRef_el is None:
            errors.append({"code":"MISSING_FIELD", "message":"sensorRef ausente","xpath":base_xpath + "/sensorRef"})
            sensor_ref = None
        else:
            sensor_ref = sensorRef_el.get("ref")
            if sensor_ref not in sensors:
                errors.append({"code":"INVALID_REF","message":f"sensorRef ref='{sensor_ref}' não corresponde a nenhum sensor id","xpath": base_xpath + "/sensorRef"})
        # valor
        valor_el = l.find("valor")
        if valor_el is None:
            errors.append({"code":"MISSING_FIELD","message":"valor ausente","xpath": base_xpath + "/valor"})
            valor = None
        else:
            try:
                valor = float(valor_el.text)
            except:
                errors.append({"code":"INVALID_NUMBER","message":"valor não é numérico","xpath": base_xpath + "/valor"})
                valor = None

        # check range if possible
        status = "ok"
        if sensor_ref and sensor_ref in sensors and valor is not None:
            tipo_sensor = sensors.get(sensor_ref)
            if tipo_sensor in RANGES:
                lo, hi = RANGES[tipo_sensor]
                if not (lo <= valor <= hi):
                    status = "out_of_range"
                    errors.append({"code":"OUT_OF_RANGE","message":f"Elemento 'valor' fora da faixa [{lo}..{hi}] para tipo '{tipo_sensor}'","xpath": base_xpath + "/valor"})
            else:
                # unknown tipo: we can still mark unknown-range
                status = "unknown_range"
        leituras.append({
            "dataHora": dataHora.isoformat() if dataHora else None,
            "sensorRef": sensor_ref,
            "valor": valor,
            "status": status,
            "xpath": base_xpath
        })

    # uniqueness of leituras keys? (example: same sensor+timestamp duplicate)
    seen = set()
    for r in leituras:
        key = (r["sensorRef"], r["dataHora"])
        if key in seen:
            errors.append({"code":"DUPLICATE_READING","message":f"Leitura duplicada para sensor {r['sensorRef']} em {r['dataHora']}","xpath": r.get("xpath")})
        else:
            seen.add(key)

    # prepare meta
    meta = {
        "estufa": doc.findtext("nome"),
        "localizacao": doc.findtext("localizacao"),
        "sensors": sensors,
        "leituras": leituras
    }
    return errors, meta
