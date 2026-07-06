from flask import request, jsonify
from app.api import bp
from app.models import LibrarySetting
from app.extensions import db
from app.utils.decorators import role_required

DEFAULTS = {
    'fine_rate_per_day': '10',
}

def get_setting(key):
    """Return setting value as string, falling back to default."""
    row = LibrarySetting.query.get(key)
    if row:
        return row.value
    return DEFAULTS.get(key)


@bp.route('/settings', methods=['GET'])
def get_settings():
    """Return all library settings (public — used by frontend)."""
    rows = {row.key: row.value for row in LibrarySetting.query.all()}
    # Merge with defaults so every key is always present
    merged = {**DEFAULTS, **rows}
    return jsonify(merged), 200


@bp.route('/settings', methods=['PUT'])
@role_required('admin')
def update_settings():
    """Update one or more settings. Admin only."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({'error': 'Invalid payload'}), 400

    updated = {}
    for key, value in data.items():
        if key not in DEFAULTS:
            return jsonify({'error': f'Unknown setting key: {key}'}), 400
        # Validate fine_rate_per_day
        if key == 'fine_rate_per_day':
            try:
                rate = float(value)
                if rate < 0:
                    raise ValueError
            except (ValueError, TypeError):
                return jsonify({'error': 'fine_rate_per_day must be a non-negative number'}), 400

        row = LibrarySetting.query.get(key)
        if row:
            row.value = str(value)
        else:
            row = LibrarySetting(key=key, value=str(value))
            db.session.add(row)
        updated[key] = str(value)

    db.session.commit()
    return jsonify({'message': 'Settings updated', 'settings': updated}), 200
