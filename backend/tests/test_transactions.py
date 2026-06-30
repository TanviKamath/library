# pyrefly: ignore [missing-import]
import pytest
from datetime import datetime, timedelta, timezone

def get_token(client, email, password):
    response = client.post('/api/v1/auth/login', json={
        'email': email,
        'password': password
    })
    return response.json['access_token']

def test_issue_book_success(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    book = init_db['book']
    member = init_db['member']
    
    response = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    
    assert response.status_code == 201
    assert response.json['status'] == 'active'

def test_issue_book_zero_copies(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    book = init_db['book']
    member = init_db['member']
    
    # Issue all 5 copies
    for _ in range(5):
        res = client.post('/api/v1/transactions/issue', json={
            'book_id': book.id,
            'user_id': member.id
        }, headers={'Authorization': f'Bearer {admin_token}'})
        assert res.status_code == 201
        
    # Attempt to issue 6th copy
    response = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    
    assert response.status_code == 400
    assert 'Book not available' in response.json['error']

def test_return_book_on_time(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    book = init_db['book']
    member = init_db['member']
    
    # Issue a book
    res = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    txn_id = res.json['id']
    
    # Return the book
    response = client.post('/api/v1/transactions/return', json={
        'transaction_id': txn_id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    
    assert response.status_code == 200
    assert response.json['status'] == 'returned'
    assert response.json['fine_amount'] == 0

def test_return_book_late(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    book = init_db['book']
    member = init_db['member']
    
    # Issue a book with a past due date
    past_due = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    res = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id,
        'due_date': past_due
    }, headers={'Authorization': f'Bearer {admin_token}'})
    txn_id = res.json['id']
        
    response = client.post('/api/v1/transactions/return', json={
        'transaction_id': txn_id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    
    assert response.status_code == 200
    assert response.json['status'] == 'returned'
    assert response.json['fine_amount'] >= 30 
    assert response.json['fine_paid'] == False

def test_renewal_workflow(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    member_token = get_token(client, 'member@test.com', 'member')
    book = init_db['book']
    member = init_db['member']
    
    # Issue book
    res = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id
    }, headers={'Authorization': f'Bearer {admin_token}'})
    txn_id = res.json['id']

    # Member requests renewal
    response = client.post('/api/v1/transactions/renew/request', json={
        'transaction_id': txn_id
    }, headers={'Authorization': f'Bearer {member_token}'})
    assert response.status_code == 200
    assert response.json['status'] == 'active'
    assert response.json['type'] == 'renew'
    assert response.json['parent_transaction_id'] == txn_id

def test_settle_fine(client, init_db):
    admin_token = get_token(client, 'admin@test.com', 'admin')
    book = init_db['book']
    member = init_db['member']
    
    # Issue overdue book
    past_due = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    res = client.post('/api/v1/transactions/issue', json={
        'book_id': book.id,
        'user_id': member.id,
        'due_date': past_due
    }, headers={'Authorization': f'Bearer {admin_token}'})
    txn_id = res.json['id']
    
    # Return it to generate fine
    client.post('/api/v1/transactions/return', json={
        'transaction_id': txn_id
    }, headers={'Authorization': f'Bearer {admin_token}'})
        
    # Settle the fine
    response = client.post(f'/api/v1/fines/{txn_id}/pay', headers={'Authorization': f'Bearer {admin_token}'})
    
    assert response.status_code == 200
    assert response.json['transaction']['fine_paid'] == True

def test_borrow_book_success(client, init_db):
    member_token = get_token(client, 'member@test.com', 'member')
    book = init_db['book']
    
    # Borrow book directly as member
    res = client.post('/api/v1/transactions/borrow', json={
        'book_id': book.id
    }, headers={'Authorization': f'Bearer {member_token}'})
    
    assert res.status_code == 201
    assert res.json['status'] == 'active'
    assert res.json['book_id'] == book.id
    assert res.json['user_id'] == init_db['member'].id
