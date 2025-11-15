import os
from flask import Flask
from dotenv import load_dotenv
from flask_cors import CORS

def create_app():
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "config", ".env.example"))
    app = Flask(__name__)
    app.config['DATA_DIR'] = os.getenv("DATA_DIR", os.path.join(os.path.dirname(__file__), "..", "data"))
    os.makedirs(app.config['DATA_DIR'], exist_ok=True)

    # HABILITA CORS PARA FRONTEND EM OUTRA PORTA
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    from .routes import bp
    app.register_blueprint(bp)
    return app
