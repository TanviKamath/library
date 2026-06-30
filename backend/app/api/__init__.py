from flask import Blueprint

bp = Blueprint('api', __name__, url_prefix='/api/v1')

from . import auth, books, categories, members, transactions, stats, fines, reservations, likes, recommendations, reviews, activity, spotlight
