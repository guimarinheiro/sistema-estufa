import os
import json
import uuid
from datetime import datetime
from xml.etree import ElementTree as ET

def generate_id(prefix="leitura"):
    return f"{prefix}_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}_{uuid.uuid4().hex[:6]}"

def save_xml_and_meta(data_dir, xml_bytes, xml_id, meta):
    xml_path = os.path.join(data_dir, f"{xml_id}.xml")
    meta_path = os.path.join(data_dir, f"{xml_id}.meta.json")
    with open(xml_path, "wb") as f:
        f.write(xml_bytes)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return xml_path, meta_path

def load_meta(data_dir, xml_id):
    path = os.path.join(data_dir, f"{xml_id}.meta.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def list_metas(data_dir):
    metas = []
    for name in os.listdir(data_dir):
        if name.endswith(".meta.json"):
            with open(os.path.join(data_dir, name), "r", encoding="utf-8") as f:
                metas.append(json.load(f))
    return metas

def xml_to_string(xml_tree):
    return ET.tostring(xml_tree, encoding="utf-8", xml_declaration=True)
