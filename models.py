from extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    client_id = db.Column(db.String(50), nullable=False)
    api_key = db.Column(db.String(100), nullable=False)
    access_token = db.Column(db.String(1000), nullable=True)

    def __repr__(self):
        return f'<User {self.username}>'
