from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timezone
import random

from app.api import bp
from app.extensions import db, cache
from app.models import Book, Transaction
from app.models.barista import BaristaProfile, BaristaInteractionLog

# Helper to ensure barista profile exists
def get_or_create_profile(user_id):
    profile = BaristaProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = BaristaProfile(user_id=user_id)
        db.session.add(profile)
        db.session.commit()
    return profile

def derive_relationship_stage(user_id):
    # If user has >= 5 transactions, they are a regular
    tx_count = Transaction.query.filter_by(user_id=user_id).count()
    if tx_count >= 5:
        return 'regular'
    return 'apprentice'

@bp.route('/barista/profile', methods=['GET'])
@jwt_required()
def get_barista_profile():
    user_id = get_jwt_identity()
    profile = get_or_create_profile(user_id)
    
    # Auto-derive relationship stage
    current_stage = derive_relationship_stage(user_id)
    if profile.relationship_stage != current_stage:
        profile.relationship_stage = current_stage
        db.session.commit()
        
    return jsonify(profile.to_dict()), 200

@bp.route('/barista/onboard', methods=['POST'])
@jwt_required()
def barista_onboard():
    user_id = get_jwt_identity()
    profile = get_or_create_profile(user_id)
    
    data = request.get_json() or {}
    skipped = data.get('skipped', False)
    
    profile.has_completed_onboarding = True
    
    if not skipped:
        profile.pace_preference = data.get('pace_preference', 'unknown')
        profile.favorite_categories_cache = data.get('favorite_categories', [])
        profile.skill_level = data.get('skill_level')
        profile.reading_count = data.get('reading_count')
        
    db.session.commit()
    return jsonify({'message': 'Onboarding complete', 'profile': profile.to_dict()}), 200

@bp.route('/barista/recommend', methods=['POST'])
@jwt_required()
def barista_recommend():
    user_id = get_jwt_identity()
    profile = get_or_create_profile(user_id)
    
    data = request.get_json() or {}
    mood_tag = data.get('mood_tag')
    
    # Use the smarter recommender (cached for 30 seconds)
    from app.services.finn_recommender import recommend
    from app.services import finn_learning, finn_voice
    # Cached wrapper – memoized per user + mood tag + preference version.
    @cache.memoize(30)
    def _cached_recommend(user_id, mood_tag, version):
        # Ensure a profile exists for the user.
        profile = BaristaProfile.query.filter_by(user_id=user_id).first()
        if not profile:
            raise RuntimeError('Barista profile not found for user')
        # Use recommender to get a Book instance and reasons.
        book, reasons = recommend(profile, mood_tag)
        # Return the book's ID (or None) and reasons; model instances are not cached.
        return (book.id if book else None), reasons

    try:
        recommended_book_id, why_reasons = _cached_recommend(user_id, mood_tag, profile.preference_version)
    except Exception as e:
        # Log the error and return a generic server error response.
        from flask import current_app
        current_app.logger.error(f'Barista recommendation failed: {e}')
        return jsonify({'error': 'Failed to generate recommendation'}), 500

    if not recommended_book_id:
        return jsonify({'error': 'No books available right now!'}), 404

    # Load the recommended book from the DB.
    recommended_book = Book.query.get(recommended_book_id)
    if not recommended_book:
        # This should not happen, but handle gracefully.
        return jsonify({'error': 'Recommended book not found'}), 404

    # Build why_line from the textual reasons (fallback to generic if empty)
    if why_reasons:
        why_line = "Because " + ", ".join(why_reasons) + "."
    else:
        why_line = "Based on your preferences, this should hit the right note."

    # Generate voice line via composable voice system (delegated to finn_voice).
    voice_line = finn_voice.generate_voice_line(profile, mood_tag, profile.last_voice_fragments)

    # Keep the recommender's specific reasons; only fall back to generic
    # for apprentices who have NO reasons yet.  Pace flavor is appended,
    # never overwrites.
    if not why_reasons and profile.relationship_stage == 'apprentice':
        why_line = "A solid, highly-rated choice that many of our patrons love."
    else:
        pace_note = ""
        if profile.pace_preference == 'fast_read':
            pace_note = " It's a quick read, too."
        elif profile.pace_preference == 'slow_burn':
            pace_note = " A world worth savoring slowly."
        why_line = why_line + pace_note
    # Log interaction
    log = BaristaInteractionLog(
        user_id=user_id,
        interaction_type='recommendation',
        mood_tag=mood_tag,
        book_recommended_id=recommended_book.id
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'interaction_id': log.id,
        'book': recommended_book.to_dict(),
        'voice_line': voice_line,
        'why_line': why_line
    }), 200

VALID_REACTIONS = {'loved', 'liked', 'not_for_me', 'already_read'}

@bp.route('/barista/respond', methods=['POST'])
@jwt_required()
def barista_respond():
    user_id = get_jwt_identity()
    data = request.get_json() or {}

    interaction_id = data.get('interaction_id')
    response = data.get('response')  # 'accepted' or 'declined'
    rating = data.get('rating')      # optional int 1-5
    reaction = data.get('reaction')  # optional enum

    if not interaction_id or not response:
        return jsonify({'error': 'Missing parameters'}), 400

    # Validate optional fields
    if rating is not None:
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return jsonify({'error': 'rating must be an integer 1-5'}), 400
        if rating < 1 or rating > 5:
            return jsonify({'error': 'rating must be between 1 and 5'}), 400

    if reaction is not None and reaction not in VALID_REACTIONS:
        return jsonify({'error': f'reaction must be one of {sorted(VALID_REACTIONS)}'}), 400

    log = BaristaInteractionLog.query.filter_by(id=interaction_id, user_id=user_id).first()
    if not log:
        return jsonify({'error': 'Interaction not found'}), 404

    log.user_response = response
    if rating is not None:
        log.rating = rating
    if reaction is not None:
        log.reaction = reaction
    db.session.commit()

    # Feed the learning service to update preference weights.
    from app.services import finn_learning
    finn_learning.process_interaction(log)

    # Return updated preference_version so the frontend knows the cache busted.
    profile = get_or_create_profile(user_id)
    return jsonify({
        'message': 'Response recorded',
        'preference_version': profile.preference_version
    }), 200


@bp.route('/barista/swipe-deck', methods=['POST'])
@jwt_required()
def barista_swipe_deck():
    """Return 8-10 candidate books for the swipe-deck UI.

    Each card comes with a pre-created interaction log (type='swipe',
    response='pending') so the frontend can POST to /barista/respond with
    the interaction_id and a reaction of 'liked' or 'not_for_me'.
    """
    user_id = get_jwt_identity()
    profile = get_or_create_profile(user_id)

    from app.services.finn_recommender import get_swipe_deck
    from app.services import finn_voice

    deck_items = get_swipe_deck(profile, count=5)
    if not deck_items:
        return jsonify({'error': 'No books available for swiping right now!'}), 404

    # Create a pending interaction log for each card so the frontend can
    # respond to them individually.
    cards = []
    for item in deck_items:
        log = BaristaInteractionLog(
            user_id=user_id,
            interaction_type='swipe',
            book_recommended_id=item['book']['id'],
        )
        db.session.add(log)
        db.session.flush()  # get the id without committing yet
        cards.append({
            'interaction_id': log.id,
            'book': item['book'],
            'reasons': item['reasons'],
        })
    db.session.commit()

    voice_line = finn_voice.generate_voice_line(profile, None, profile.last_voice_fragments)
    db.session.commit()  # persist voice fragment history

    return jsonify({
        'cards': cards,
        'voice_line': voice_line,
    }), 200


@bp.route('/barista/spin', methods=['POST'])
@jwt_required()
def barista_spin():
    """Return 6 books as wheel segments plus a random winning index.

    The winning book is logged as interaction_type='spin'.  All 6
    candidates are drawn from learned preferences + wildcards so every
    possible outcome is decent.
    """
    user_id = get_jwt_identity()
    profile = get_or_create_profile(user_id)

    from app.services.finn_recommender import get_spin_candidates
    from app.services import finn_voice

    candidates = get_spin_candidates(profile, count=6)
    if not candidates:
        return jsonify({'error': 'No books available for spinning right now!'}), 404

    # Choose a random winner
    winning_index = random.randint(0, len(candidates) - 1)
    winning_book = candidates[winning_index]

    # Log only the winning book
    log = BaristaInteractionLog(
        user_id=user_id,
        interaction_type='spin',
        book_recommended_id=winning_book.id,
    )
    db.session.add(log)
    db.session.commit()

    voice_line = finn_voice.generate_voice_line(profile, None, profile.last_voice_fragments)
    db.session.commit()  # persist voice fragment history

    return jsonify({
        'segments': [book.to_dict() for book in candidates],
        'winning_index': winning_index,
        'interaction_id': log.id,
        'voice_line': voice_line,
    }), 200
