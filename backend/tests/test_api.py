import os
import requests

BASE_URL = "http://localhost:5000/api/xml"

def send_xml(filepath):
    print(f"\nEnviando XML: {filepath}")

    with open(filepath, "rb") as f:
        xml_data = f.read()

    headers = {"Content-Type": "application/xml"}

    response = requests.post(BASE_URL, data=xml_data, headers=headers)

    print("Status code:", response.status_code)
    print("Resposta da API:")
    print(response.text)

    return response


def main():
    # Caminho da pasta onde estão os XMLs de teste
    xml_dir = os.path.join("xml")

    if not os.path.exists(xml_dir):
        print("❌ Diretório tests/xml não encontrado!")
        return

    # Lista todos os arquivos XML
    xml_files = [f for f in os.listdir(xml_dir) if f.endswith(".xml")]

    if not xml_files:
        print("❌ Nenhum arquivo XML encontrado em tests/xml")
        return

    print("🔧 Iniciando testes automáticos (estilo curl)...")

    for xml in xml_files:
        filepath = os.path.join(xml_dir, xml)
        send_xml(filepath)

    print("\n✅ Todos os testes executados!")


if __name__ == "__main__":
    main()
