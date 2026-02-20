from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

# Database setup
def init_db():
    conn = sqlite3.connect('booking.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            line_id TEXT,
            contact_time TEXT NOT NULL,
            goal TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

@app.route('/api/booking', methods=['POST'])
def submit_booking():
    try:
        data = request.json
        name = data.get('name', '')
        phone = data.get('phone', '')
        line_id = data.get('line_id', '')
        contact_time = data.get('contact_time', '')
        goal = data.get('goal', '')

        if not name or not phone or not contact_time or not goal:
            return jsonify({'success': False, 'message': '請填寫所有必填欄位'}), 400

        conn = sqlite3.connect('booking.db')
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO bookings (name, phone, line_id, contact_time, goal)
            VALUES (?, ?, ?, ?, ?)
        ''', (name, phone, line_id, contact_time, goal))
        conn.commit()
        conn.close()

        return jsonify({'success': True, 'message': '預約提交成功！我們會盡快與您聯絡。'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'提交失敗: {str(e)}'}), 500

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    try:
        conn = sqlite3.connect('booking.db')
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM bookings ORDER BY created_at DESC')
        bookings = cursor.fetchall()
        conn.close()

        bookings_list = []
        for booking in bookings:
            bookings_list.append({
                'id': booking[0],
                'name': booking[1],
                'phone': booking[2],
                'line_id': booking[3],
                'contact_time': booking[4],
                'goal': booking[5],
                'created_at': booking[6]
            })

        return jsonify({'success': True, 'bookings': bookings_list}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': f'獲取資料失敗: {str(e)}'}), 500

# Serve HTML pages
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/about')
def about():
    return send_from_directory('_pages', 'about.html')

@app.route('/programmes')
def programmes():
    return send_from_directory('_pages', 'programmes.html')

@app.route('/testimonials')
def testimonials():
    return send_from_directory('_pages', 'testimonials.html')

@app.route('/blog')
def blog():
    return send_from_directory('_pages', 'blog.html')

@app.route('/faq')
def faq():
    return send_from_directory('_pages', 'faq.html')

@app.route('/booking')
def booking():
    return send_from_directory('_pages', 'booking.html')

# Serve static files (CSS, images, HTML pages)
@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('css/'):
        return send_from_directory('css', filename[4:])
    elif filename.startswith('img/'):
        return send_from_directory('img', filename[4:])
    elif filename.startswith('_includes/'):
        return send_from_directory('_includes', filename[10:])
    elif filename.endswith('.html'):
        # Check if it's in _pages/ directory
        page_file = filename
        if os.path.exists(os.path.join('_pages', page_file)):
            return send_from_directory('_pages', page_file)
        elif os.path.exists(page_file):
            return send_from_directory('.', page_file)
        else:
            return f"File not found: {filename}", 404
    else:
        return send_from_directory('.', filename)

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5001)
