from flask import Flask, request, jsonify, send_file
import jwt
import json
import os
from kafka import KafkaProducer, KafkaConsumer
from kafka.admin import KafkaAdminClient  # Added for Kafka readiness check
import threading
from flask_cors import CORS
import time
import uuid
import redis

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})
SECRET_KEY = "your-secret-key"
time.sleep(10)  # Simulate a delay for the supernode to be ready
# Initialize Redis client
redis_client = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)

# Function to wait for Kafka to be ready
def wait_for_kafka():
    retries = 6  # 6 retries * 5 seconds = 30 seconds max wait
    for i in range(retries):
        try:
            admin_client = KafkaAdminClient(bootstrap_servers='kafka:9092')
            admin_client.list_topics()  # Test Kafka connectivity
            print("Kafka is ready")
            return
        except Exception as e:
            print(f"Kafka not ready, attempt {i+1}/{retries}: {e}")
            if i < retries - 1:
                time.sleep(5)
    raise Exception("Kafka failed to start after maximum retries")

# Initialize Kafka producer with retry
def create_kafka_producer():
    wait_for_kafka()  # Wait for Kafka to be ready
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

# Load users from users.json (keeping users in JSON for simplicity)
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

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f)

users = load_data('users.json', {})

# Sync with replica (eventual consistency)
def sync_with_replica():
    while True:
        file_keys = redis_client.keys('file:*')
        files = {}
        for key in file_keys:
            file_id = key.split(':')[1]
            file_data = redis_client.hgetall(key)
            files[file_id] = file_data
        shared_with_keys = redis_client.keys('shared_with:*')
        shared_with = {}
        for key in shared_with_keys:
            email = key.split(':')[1]
            shared_files = list(redis_client.smembers(key))
            shared_with[email] = shared_files
        producer.send('sync', {'users': users, 'files': files, 'shared_with': shared_with})
        time.sleep(1)

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
    file_id = str(uuid.uuid4())
    file_path = f"files/{file_id}"
    file.seek(0, os.SEEK_END)
    file_size = file.tell()
    file.seek(0)  # Reset file pointer to beginning
    file.save(file_path)
    redis_client.hset(f"file:{file_id}", mapping={
        'name': file.filename,
        'owner': email,
        'path': file_path,
        'size': str(file_size),
        'upload_date': str(int(time.time()))
    })
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
    file_keys = redis_client.keys('file:*')
    user_files = []
    for key in file_keys:
        file_id = key.split(':')[1]
        file_data = redis_client.hgetall(key)
        if file_data.get('owner') == email:
            user_files.append({
                'id': file_id, 
                'name': file_data['name'], 
                'shared': False,
                'size': file_data.get('size', '0'),
                'upload_date': file_data.get('upload_date')
            })
    shared_file_ids = redis_client.smembers(f"shared_with:{email}")
    for file_id in shared_file_ids:
        file_key = f"file:{file_id}"
        if redis_client.exists(file_key):
            file_data = redis_client.hgetall(file_key)
            user_files.append({
                'id': file_id, 
                'name': file_data['name'], 
                'shared': True, 
                'owner': file_data['owner'],
                'size': file_data.get('size', '0'), 
                'upload_date': file_data.get('upload_date')
            })
    return jsonify({'files': user_files})

@app.route('/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    if file_data.get('owner') != email:
        return jsonify({'message': 'Unauthorized'}), 404
    os.remove(file_data['path'])
    for shared_key in redis_client.keys('shared_with:*'):
        redis_client.srem(shared_key, file_id)
    redis_client.delete(file_key)
    producer.send('delete', {'file_id': file_id})
    return jsonify({'message': 'File deleted'})

@app.route('/share/email', methods=['POST'])
def share_email():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    data = request.json
    file_id = data['file_id']
    target_email = data['email']
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    if file_data.get('owner') != email:
        return jsonify({'message': 'Unauthorized'}), 404
    redis_client.sadd(f"shared_with:{target_email}", file_id)
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
    
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    if file_data.get('owner') != email:
        return jsonify({'message': 'Unauthorized'}), 404
    
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
    
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    shared_file_ids = redis_client.smembers(f"shared_with:{email}")
    if file_data.get('owner') != email and file_id not in shared_file_ids:
        return jsonify({'message': 'Unauthorized'}), 404
    
    file_path = file_data['path']
    file_name = file_data['name']
    return send_file(file_path, as_attachment=True, download_name=file_name)

@app.route('/files/<file_id>/fetch', methods=['GET'])
def fetch_file(file_id):
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    file_path = file_data['path']
    return send_file(file_path, as_attachment=False)

@app.route('/files/<file_id>/public', methods=['GET'])
def public_download_file(file_id):
    file_key = f"file:{file_id}"
    if not redis_client.exists(file_key):
        return jsonify({'message': 'File not found'}), 404
    file_data = redis_client.hgetall(file_key)
    file_path = file_data['path']
    file_name = file_data['name']
    return send_file(file_path, as_attachment=True, download_name=file_name)

# Add these endpoints to your backend application

@app.route('/profile', methods=['GET'])
def get_profile():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    
    user_data = users[email]
    # Don't send password in the response
    profile = {
        'email': email,
        'fullName': user_data.get('fullName', ''),
        'organization': user_data.get('organization', ''),
        'bio': user_data.get('bio', ''),
        'createdAt': user_data.get('createdAt', str(int(time.time())))
    }
    
    return jsonify(profile)

@app.route('/profile', methods=['PUT'])
def update_profile():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    
    data = request.json
    
    # Update user data
    users[email]['fullName'] = data.get('fullName', users[email].get('fullName', ''))
    users[email]['organization'] = data.get('organization', users[email].get('organization', ''))
    users[email]['bio'] = data.get('bio', users[email].get('bio', ''))
    
    # Save to persistent storage
    save_data('users.json', users)
    
    # Return updated profile
    profile = {
        'email': email,
        'fullName': users[email].get('fullName', ''),
        'organization': users[email].get('organization', ''),
        'bio': users[email].get('bio', ''),
        'createdAt': users[email].get('createdAt', str(int(time.time())))
    }
    
    return jsonify(profile)

@app.route('/profile/password', methods=['PUT'])
def change_password():
    token = request.headers.get('Authorization').split()[1]
    email = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])['email']
    
    data = request.json
    current_password = data.get('currentPassword')
    new_password = data.get('newPassword')
    
    # Verify current password
    if users[email].get('password') != current_password:
        return jsonify({'message': 'Current password is incorrect'}), 400
    
    # Update password
    users[email]['password'] = new_password
    
    # Save to persistent storage
    save_data('users.json', users)
    
    return jsonify({'message': 'Password updated successfully'})

if __name__ == '__main__':
    os.makedirs('files', exist_ok=True)
    app.run(host='0.0.0.0', port=5000)