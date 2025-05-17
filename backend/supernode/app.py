from flask import Flask, request, jsonify, send_file
import jwt
import json
import os
from kafka import KafkaProducer, KafkaConsumer
import threading
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
SECRET_KEY = "your-secret-key"

# Initialize Kafka producer with retry
def create_kafka_producer():
    retries = 5
    for i in range(retries):
        try:
            producer = KafkaProducer(
                bootstrap_servers='kafka:9092',
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            print("Kafka producer connected successfully")
            return producer
        except Exception as e:
            print(f"Kafka producer connection attempt {i+1}/{retries} failed: {e}")
            if i < retries - 1:
                time.sleep(5)
    raise Exception("Failed to connect to Kafka after multiple attempts")

producer = create_kafka_producer()

# Load users and files
def load_data(file_path, default_data):
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r') as f:
                content = f.read().strip()
                if not content:
                    return default_data
                return json.loads(content)
        except (json.JSONDecodeError, IOError):
            return default_data
    return default_data

users = load_data('users.json', {})
files = load_data('files.json', {})

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f)

# Sync with replica (eventual consistency)
def sync_with_replica():
    while True:
        producer.send('sync', {'users': users, 'files': files})

threading.Thread(target=sync_with_replica, daemon=True).start()

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    if email in users:
        return jsonify({'message': 'User already exists'}), 400
    users[email] = {'password': password}
    save_data('users.json', users)
    token = jwt.encode({'email': email}, SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    if email not in users or users[email]['password'] != password:
        return jsonify({'message': 'Invalid credentials'}), 401
    token = jwt.encode({'email': email}, SECRET_KEY, algorithm='HS256')
    return jsonify({'token': token})

@app.route('/upload', methods=['POST'])
def upload():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    file = request.files['file']
    file_id = str(len(files) + 1)
    file_path = f"files/{file_id}"
    file.save(file_path)
    files[file_id] = {'name': file.filename, 'owner': email, 'path': file_path}
    save_data('files.json', files)
    try:
        producer.send('upload', {'file_id': file_id, 'path': file_path})
        print(f"Sent Kafka message to 'upload' topic: file_id={file_id}, path={file_path}")
    except Exception as e:
        print(f"Failed to send Kafka message to 'upload' topic: {e}")
    return jsonify({'message': 'File uploaded'})

@app.route('/files', methods=['GET'])
def list_files():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    user_files = [{'id': k, 'name': v['name']} for k, v in files.items() if v['owner'] == email]
    return jsonify({'files': user_files})

@app.route('/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    if file_id not in files or files[file_id]['owner'] != email:
        return jsonify({'message': 'File not found or unauthorized'}), 404
    os.remove(files[file_id]['path'])
    del files[file_id]
    save_data('files.json', files)
    producer.send('delete', {'file_id': file_id})
    return jsonify({'message': 'File deleted'})

@app.route('/share/email', methods=['POST'])
def share_email():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    data = request.json
    file_id = data['file_id']
    target_email = data['email']
    if file_id not in files or files[file_id]['owner'] != email:
        return jsonify({'message': 'File not found or unauthorized'}), 404
    return jsonify({'message': 'File shared via email'})

@app.route('/share/public', methods=['POST'])
def share_public():
    auth_header = request.headers.get('Authorization')
    if not auth_header or len(auth_header.split()) != 2:
        return jsonify({'message': 'Missing or invalid Authorization header'}), 401
    
    token = auth_header.split()[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        email = payload.get('email')
        if not email:
            return jsonify({'message': 'Invalid token: email missing'}), 401
    except jwt.exceptions.InvalidTokenError:
        return jsonify({'message': 'Invalid token'}), 401
    
    print('Request body:', request.json)
    if not request.json or 'file_id' not in request.json:
        return jsonify({'message': 'Missing file_id in request body'}), 400
    
    file_id = request.json['file_id']
    
    if file_id not in files or files[file_id]['owner'] != email:
        return jsonify({'message': 'File not found or unauthorized'}), 404
    
    link = f"http://localhost:5000/files/{file_id}/public"
    return jsonify({'link': link})

@app.route('/files/<file_id>/download', methods=['GET'])
def download_file(file_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or len(auth_header.split()) != 2:
        return jsonify({'message': 'Missing or invalid Authorization header'}), 401
    
    token = auth_header.split()[1]
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        email = payload.get('email')
        if not email:
            return jsonify({'message': 'Invalid token: email missing'}), 401
    except jwt.exceptions.InvalidTokenError:
        return jsonify({'message': 'Invalid token'}), 401
    
    if file_id not in files or files[file_id]['owner'] != email:
        return jsonify({'message': 'File not found or unauthorized'}), 404
    
    file_path = files[file_id]['path']
    file_name = files[file_id]['name']
    return send_file(file_path, as_attachment=True, download_name=file_name)

@app.route('/files/<file_id>/fetch', methods=['GET'])
def fetch_file(file_id):
    if file_id not in files:
        return jsonify({'message': 'File not found'}), 404
    file_path = files[file_id]['path']
    return send_file(file_path, as_attachment=False)

@app.route('/files/<file_id>/public', methods=['GET'])  # New endpoint for public links
def public_download_file(file_id):
    if file_id not in files:
        return jsonify({'message': 'File not found'}), 404
    file_path = files[file_id]['path']
    file_name = files[file_id]['name']
    return send_file(file_path, as_attachment=True, download_name=file_name)

if __name__ == '__main__':
    os.makedirs('files', exist_ok=True)
    app.run(host='0.0.0.0', port=5000)