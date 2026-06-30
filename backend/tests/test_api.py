def test_health_endpoint(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    assert response.json == {'status': 'ok'}

def test_login_and_get_books(client, init_db):
    # Test Login
    response = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.com',
        'password': 'admin'
    })
    assert response.status_code == 200
    access_token = response.json['access_token']
    
    # Test Get Books
    response = client.get('/api/v1/books', headers={
        'Authorization': f'Bearer {access_token}'
    })
    assert response.status_code == 200
    assert 'books' in response.json
    assert len(response.json['books']) == 1
    assert response.json['books'][0]['title'] == 'Test Book'
