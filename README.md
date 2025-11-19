Mini sistema para monitoramento de leituras de sensores em uma estufa de tomates. Implementado para o trabalho da matéria de Engenharia de Software

Manual de Uso (tutorial curto):

Iniciar backend no terminal (T3): cd backend → python run.py (ou via seu ambiente).

Abrir frontend: abra um segundo terminal no diretório frontend/ → python -m http.server 8080

Importar XML: na aba Detalhe/Editor, clique em Escolher arquivo → selecione exemplo.xml (T2) → clicar Importar e Validar. O conteúdo será carregado no formulário.

Editar: altere campos, adicione sensores/leituras conforme necessário. O editor faz validações instantâneas ao exportar/enviar.

Exportar: clique em Exportar cliente.xml → browser fará o download do arquivo cliente.xml.

Enviar ao Backend: clique em Enviar para Backend (POST /api/xml). Resultado e código HTTP aparecem ao lado do botão.

Consultar dados: vá à aba Lista ou Dashboard e clique Filtrar ou aguarde os indicadores serem atualizados. Eles consultam /api/consulta.

Erros: Se a validação cliente falhar, a UI mostra um alert() com os erros padronizados (code, message, xpath). O backend também pode retornar erros no mesmo formato.
