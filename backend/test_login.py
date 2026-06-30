import requests

url = "http://localhost:5000/api/v1/auth/login"
data = {"email": "admin@bookworm.com", "password": "admin123"}
response = requests.post(url, json=data)
print(response.status_code)
print(response.text)
