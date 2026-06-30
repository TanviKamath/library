from marshmallow import Schema, fields, validate

class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.String(required=True, validate=validate.Length(min=1, max=100))

class BookSchema(Schema):
    title = fields.String(required=True, validate=validate.Length(min=1, max=255))
    isbn = fields.String(validate=validate.Length(max=20))
    author_name = fields.String(required=True, validate=validate.Length(min=1, max=255))
    category_id = fields.Integer(required=True)
    description = fields.String(validate=validate.Length(max=5000))
    cover_color = fields.String(validate=validate.Length(max=20))
    total_copies = fields.Integer(validate=validate.Range(min=0, max=1000))
    rating = fields.Float(validate=validate.Range(min=0, max=5))
    gutenberg_id = fields.Integer(allow_none=True)
    cover_image_url = fields.String(allow_none=True)

class MemberSchema(Schema):
    username = fields.String(required=True, validate=validate.Length(min=2, max=64))
    email = fields.Email(required=True, validate=validate.Length(max=120))
    password = fields.String(required=True, validate=validate.Length(min=4, max=100))
    full_name = fields.String(validate=validate.Length(max=100))
    role = fields.String(validate=validate.OneOf(['member', 'librarian', 'admin']))
