from app.extensions import db


class LibrarySetting(db.Model):
    """Generic key-value store for library configuration."""
    __tablename__ = 'library_setting'

    key = db.Column(db.String(64), primary_key=True)
    value = db.Column(db.String(256), nullable=False)

    def to_dict(self):
        return {'key': self.key, 'value': self.value}
