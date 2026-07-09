import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './BaristaCompanion.module.css';
import { STRINGS } from './strings';
import SwipeDeck from './SwipeDeck';
import SpinWheel from './SpinWheel';
import { getProxiedImageUrl } from '../../utils/image';

/* ========================================
   NATURAL SPEECH TYPEWRITER
   Pauses organically at punctuation (periods, commas, question marks)
   to simulate realistic vocal pacing and human speech rhythm.
   ======================================== */
function TypewriterText({ text, baseSpeed = 26, onComplete, forceComplete }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    if (forceComplete && !done) {
      setDisplayed(text);
      setDone(true);
      onComplete?.();
    }
  }, [forceComplete, done, text, onComplete]);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    indexRef.current = 0;

    if (!text) return;

    let timerId;
    const tick = () => {
      const i = indexRef.current;
      if (i < text.length) {
        const char = text.charAt(i);
        setDisplayed(text.slice(0, i + 1));
        indexRef.current = i + 1;

        // Calculate natural conversational delay based on punctuation
        let delay = baseSpeed;
        if (char === '.' || char === '?' || char === '!') {
          delay = baseSpeed * 10; // Dramatic conversational pause at end of sentence
        } else if (char === ',' || char === '—' || char === ';' || char === ':') {
          delay = baseSpeed * 5;  // Breath pause at commas
        }

        timerId = setTimeout(tick, delay);
      } else {
        setDone(true);
        onComplete?.();
      }
    };

    timerId = setTimeout(tick, baseSpeed);
    return () => clearTimeout(timerId);
  }, [text, baseSpeed]);

  return (
    <>
      {displayed}
      {!done && <span className={styles.cursor} />}
    </>
  );
}

/* ========================================
   DIALOGUE NODE IDS
   ======================================== */
const NODE = {
  LOADING:            'LOADING',
  ONBOARD_GREETING:   'ONBOARD_GREETING',
  ONBOARD_SKILL_LEVEL: 'ONBOARD_SKILL_LEVEL',
  ONBOARD_READING_COUNT: 'ONBOARD_READING_COUNT',
  ONBOARD_PACE:       'ONBOARD_PACE',
  ONBOARD_GENRE:      'ONBOARD_GENRE',
  REGULAR_GREETING:   'REGULAR_GREETING',
  SHOW_RECOMMENDATION:'SHOW_RECOMMENDATION',
  DISCOVERY_CHOICE:   'DISCOVERY_CHOICE',
  SWIPE_DECK:         'SWIPE_DECK',
  SPIN_WHEEL:         'SPIN_WHEEL',
};

/* ========================================
   MAIN COMPONENT
   ======================================== */
export default function BaristaCompanion() {
  const { isAuthenticated, user, isAdmin, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen]           = useState(false);
  const [profile, setProfile]         = useState(null);
  const [currentNode, setCurrentNode] = useState(NODE.LOADING);
  const [currentText, setCurrentText] = useState('');
  const [isTyping, setIsTyping]       = useState(true);
  const [pacePreference, setPace]     = useState(null);
  const [skillLevel, setSkillLevel]   = useState(null);
  const [readingCount, setReadingCount] = useState(null);
  const [recommendation, setRec]      = useState(null);

  // New state for interactive modes
  const [swipeDeckData, setSwipeDeckData] = useState(null);
  const [spinData, setSpinData]           = useState(null);
  const [recImgStage, setRecImgStage]     = useState('proxy');

  /* Load profile on first open, or reset if stuck in interactive node without data */
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      if (!profile) {
        loadProfile();
      } else if (
        (currentNode === NODE.SPIN_WHEEL && !spinData) ||
        (currentNode === NODE.SWIPE_DECK && !swipeDeckData) ||
        (currentNode === NODE.SHOW_RECOMMENDATION && !recommendation)
      ) {
        goTo(NODE.REGULAR_GREETING, STRINGS.REGULAR_GREETING);
      }
    }
  }, [isAuthenticated, isOpen, profile, currentNode, spinData, swipeDeckData, recommendation]);

  /* ---- helpers ---- */
  const goTo = (node, text) => {
    setIsTyping(true);
    setCurrentNode(node);
    setCurrentText(text);
  };

  const loadProfile = async () => {
    try {
      goTo(NODE.LOADING, '');
      const data = await api.get('/barista/profile');
      setProfile(data);
      if (!data.has_completed_onboarding) {
        goTo(
          NODE.ONBOARD_GREETING,
          STRINGS.ONBOARD_GREETING
        );
      } else {
        goTo(
          NODE.REGULAR_GREETING,
          STRINGS.REGULAR_GREETING
        );
      }
    } catch (e) {
      console.error('Failed to load barista profile', e);
    }
  };

  const completeOnboarding = async (genres, skipped = false) => {
    try {
      goTo(NODE.LOADING, 'Brewing up your profile...');
      const payload = {
        skipped,
        pace_preference: pacePreference,
        favorite_categories: genres,
        skill_level: skillLevel,
        reading_count: readingCount,
      };
      const data = await api.post('/barista/onboard', payload);
      setProfile(data.profile);
      fetchRecommendation(null);
    } catch (e) {
      console.error('Onboarding failed', e);
    }
  };

  const fetchRecommendation = async (mood = null) => {
    goTo(NODE.LOADING, 'Let me see what we have freshly stocked in the back...');
    try {
      const data = await api.post('/barista/recommend', { mood_tag: mood });
      setRecImgStage('proxy');
      setRec(data);
      goTo(NODE.SHOW_RECOMMENDATION, data.voice_line);
    } catch (e) {
      console.error('Failed to fetch recommendation', e);
      goTo(NODE.REGULAR_GREETING, "Hmm, I couldn't find a match right now. Want to try another flavor?");
    }
  };

  const handleResponse = async (accepted) => {
    if (!recommendation) return;
    try {
      await api.post('/barista/respond', {
        interaction_id: recommendation.interaction_id,
        response: accepted ? 'accepted' : 'declined',
      });
      if (accepted && recommendation.book) {
        setRec(null);
        goTo(NODE.REGULAR_GREETING, STRINGS.REGULAR_GREETING);
        setIsOpen(false);
        navigate(`/app/browse/${recommendation.book.id}`);
      } else {
        // Offer to learn the user's taste via spin wheel or swipe deck
        goTo(NODE.DISCOVERY_CHOICE, STRINGS.DISCOVERY_CHOICE);
      }
    } catch (e) {
      console.error('Failed to respond', e);
    }
  };

  /* ---- Swipe deck ---- */
  const fetchSwipeDeck = async () => {
    goTo(NODE.LOADING, STRINGS.SWIPE_LOADING);
    try {
      const data = await api.post('/barista/swipe-deck');
      setSwipeDeckData(data);
      goTo(NODE.SWIPE_DECK, STRINGS.SWIPE_INTRO);
    } catch (e) {
      console.error('Failed to fetch swipe deck', e);
      goTo(NODE.REGULAR_GREETING, "Hmm, I couldn't prepare the deck right now. Let's try something else!");
    }
  };

  const handleSwipeComplete = () => {
    setSwipeDeckData(null);
    goTo(NODE.REGULAR_GREETING, STRINGS.SWIPE_COMPLETE);
  };

  /* ---- Spin wheel ---- */
  const fetchSpin = async () => {
    goTo(NODE.LOADING, STRINGS.SPIN_LOADING);
    try {
      const data = await api.post('/barista/spin');
      setSpinData(data);
      goTo(NODE.SPIN_WHEEL, STRINGS.SPIN_INTRO);
    } catch (e) {
      console.error('Failed to fetch spin data', e);
      goTo(NODE.REGULAR_GREETING, "The wheel seems stuck today. Let's try something else!");
    }
  };

  const handleSpinAccept = (book) => {
    setSpinData(null);
    goTo(NODE.REGULAR_GREETING, STRINGS.REGULAR_GREETING);
    setIsOpen(false);
    navigate(`/app/browse/${book.id}`);
  };

  const handleSpinComplete = () => {
    setSpinData(null);
    goTo(NODE.REGULAR_GREETING, STRINGS.SPIN_COMPLETE);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (
      currentNode === NODE.SPIN_WHEEL ||
      currentNode === NODE.SWIPE_DECK ||
      currentNode === NODE.SHOW_RECOMMENDATION
    ) {
      goTo(NODE.REGULAR_GREETING, STRINGS.REGULAR_GREETING);
    }
  };

  /* ---- Are we in an interactive mode? ---- */
  const isInteractiveMode = currentNode === NODE.SWIPE_DECK || currentNode === NODE.SPIN_WHEEL;

  /* ---- choices (only rendered after typewriter finishes) ---- */
  const renderChoices = () => {
    if (isTyping) return null;

    switch (currentNode) {
      case NODE.ONBOARD_GREETING:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => goTo(NODE.ONBOARD_SKILL_LEVEL, 'Do you consider yourself a beginner, intermediate, or advanced reader?')}>
              "Yes, let's calibrate my reading palate."
            </button>
            <button className={styles.narrativeChoice} onClick={() => completeOnboarding([], true)}>
              "Skip the tour — just surprise me with something good."
            </button>
          </>
        );

      case NODE.ONBOARD_SKILL_LEVEL:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => { setSkillLevel('beginner'); goTo(NODE.ONBOARD_READING_COUNT, 'How many books have you read so far?'); }}>
              "Beginner"
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setSkillLevel('intermediate'); goTo(NODE.ONBOARD_READING_COUNT, 'How many books have you read so far?'); }}>
              "Intermediate"
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setSkillLevel('advanced'); goTo(NODE.ONBOARD_READING_COUNT, 'How many books have you read so far?'); }}>
              "Advanced"
            </button>
          </>
        );

      case NODE.ONBOARD_READING_COUNT:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => { setReadingCount(5); goTo(NODE.ONBOARD_PACE, 'Excellent! First things first — how do you usually enjoy your stories?'); }}>
              "0‑5 books"
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setReadingCount(15); goTo(NODE.ONBOARD_PACE, 'Excellent! First things first — how do you usually enjoy your stories?'); }}>
              "6‑20 books"
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setReadingCount(30); goTo(NODE.ONBOARD_PACE, 'Excellent! First things first — how do you usually enjoy your stories?'); }}>
              "20+ books"
            </button>
          </>
        );

      case NODE.ONBOARD_PACE:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => { setPace('fast_read'); goTo(NODE.ONBOARD_GENRE, 'Espresso shot — I respect that! Now, what flavor notes speak to you?'); }}>
              "I like an Espresso Shot — short, gripping page-turners."
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setPace('slow_burn'); goTo(NODE.ONBOARD_GENRE, 'Slow‑brewed roast... you like to take your time. What flavor notes speak to you?'); }}>
              "A Slow‑Brewed Roast — deep world‑building to savor over weeks."
            </button>
            <button className={styles.narrativeChoice} onClick={() => { setPace('mixed'); goTo(NODE.ONBOARD_GENRE, 'House blend it is! Now, what flavor notes speak to you?'); }}>
              "I'm a House Blend reader — a mix of everything."
            </button>
          </>
        );

      case NODE.ONBOARD_GENRE:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => completeOnboarding(['Fiction', 'Romance'])}>
              "Something Cozy & Warm — fiction, romance."
            </button>
            <button className={styles.narrativeChoice} onClick={() => completeOnboarding(['Mystery', 'Sci-Fi'])}>
              "High‑Octane Thrills — mystery, sci‑fi."
            </button>
            <button className={styles.narrativeChoice} onClick={() => completeOnboarding(['Biography', 'Non-Fiction'])}>
              "Deep Focus — biographies, non‑fiction."
            </button>
          </>
        );

      case NODE.REGULAR_GREETING:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={() => fetchRecommendation('cozy')}>
              "I'm craving something Cozy & Warm today."
            </button>
            <button className={styles.narrativeChoice} onClick={() => fetchRecommendation('thrilling')}>
              "Give me High‑Octane Thrills."
            </button>
            <button className={styles.narrativeChoice} onClick={() => fetchRecommendation('focus')}>
              "I need Deep Focus."
            </button>
            <button className={styles.narrativeChoice} onClick={() => fetchRecommendation(null)}>
              "Just surprise me with your best pour." <span className={styles.sparkleIcon}>✦</span>
            </button>
          </>
        );

      case NODE.DISCOVERY_CHOICE:
        return (
          <>
            <button className={styles.narrativeChoice} onClick={fetchSpin}>
              "Let's spin the wheel! 🎰"
            </button>
            <button className={styles.narrativeChoice} onClick={fetchSwipeDeck}>
              "Let's swipe through some picks. 👆👇"
            </button>
          </>
        );

      case NODE.SHOW_RECOMMENDATION:
        if (!recommendation) return null;
        const book = recommendation.book;
        let imgSrc = null;
        if (book.cover_image_url) {
          if (recImgStage === 'proxy') imgSrc = getProxiedImageUrl(book.cover_image_url);
          else if (recImgStage === 'direct') imgSrc = book.cover_image_url;
        }

        return (
          <>
            <div className={styles.recommendationCard}>
              {imgSrc && recImgStage !== 'error' ? (
                <img
                  src={imgSrc}
                  alt={book.title}
                  className={styles.bookCover}
                  onError={() => setRecImgStage(prev => prev === 'proxy' ? 'direct' : 'error')}
                />
              ) : (
                <div
                  className={styles.bookCoverPlaceholder}
                  style={{ background: book.cover_color || '#8B5A2B' }}
                >
                  {book.title}
                </div>
              )}
              <div className={styles.bookInfo}>
                <h3>{recommendation.book.title}</h3>
                <div style={{ fontStyle: 'italic', color: '#8B5A2B' }}>
                  by {recommendation.book.author_name || 'Unknown'}
                </div>
                <div className={styles.tastingNotes}>
                  <strong>Tasting Notes: </strong>
                  {recommendation.why_line}
                </div>
              </div>
            </div>

            <button className={styles.narrativeChoice} onClick={() => handleResponse(true)}>
              "I'll take it! That sounds perfect."
            </button>
            <button className={styles.narrativeChoice} onClick={() => handleResponse(false)}>
              "Hmm... brew me something else instead."
            </button>
          </>
        );

      case NODE.SWIPE_DECK:
        if (!swipeDeckData) return null;
        return (
          <div className={styles.interactiveArea}>
            <SwipeDeck
              cards={swipeDeckData.cards}
              onComplete={handleSwipeComplete}
            />
          </div>
        );

      case NODE.SPIN_WHEEL:
        if (!spinData) return null;
        return (
          <div className={styles.interactiveArea}>
            <SpinWheel
              segments={spinData.segments}
              winningIndex={spinData.winning_index}
              interactionId={spinData.interaction_id}
              voiceLine={spinData.voice_line}
              onAccept={handleSpinAccept}
              onComplete={handleSpinComplete}
            />
          </div>
        );

      default:
        return null;
    }
  };

  /* ---- render ---- */
  if (!isAuthenticated) return null;
  if (isAdmin || isStaff || user?.role === 'admin' || user?.role === 'librarian') return null;
  if (location.pathname.toLowerCase().includes('admin')) return null;

  return (
    <>
      {/* Floating trigger */}
      <div className={styles.companionContainer}>
        <button
          className={styles.floatingTrigger}
          onClick={() => setIsOpen(true)}
          aria-label="Talk to Mr. Finn"
        >
          <img src="/barista_avatar.jpg" alt="Mr. Finn" className={styles.avatarImage} />
          {!isOpen && profile && !profile.has_completed_onboarding && (
            <span className={styles.steamBadge}>New</span>
          )}
        </button>
      </div>

      {/* Cinematic overlay */}
      <div className={`${styles.rpgOverlay} ${isOpen ? styles.open : ''}`}>
        {/* Character sprite — animated with speaking or idle breathing state */}
        <div className={`${styles.characterContainer} ${isTyping ? styles.speaking : styles.idle}`}>
          <picture style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
            <source media="(max-width: 900px)" srcSet="/barista_avatar.jpg" />
            <img src="/barista_sprite.png" alt="Mr. Finn" className={styles.characterSprite} />
          </picture>
        </div>

        {/* Dialogue area — right side wooden menu board */}
        <div className={`${styles.dialogueWrapper} ${isInteractiveMode ? styles.fullWidthMode : ''}`}>
          <button className={styles.closeButton} onClick={handleClose} aria-label="Close">&times;</button>

          {/* Speech bubble box aligned near Finn's mouth */}
          <div className={styles.dialogueBox} onClick={() => setIsTyping(false)}>
            <div className={styles.speakerName}>
              <span>MR. FINN</span>
              <span className={styles.quillIcon}>✒️</span>
            </div>
            <div className={styles.dialogueText}>
              {isOpen && currentText && (
                <TypewriterText
                  text={currentText}
                  forceComplete={!isTyping}
                  onComplete={() => setIsTyping(false)}
                />
              )}
            </div>
          </div>

          {/* Choices — conversational replies or interactive components */}
          <div className={`${styles.choicesContainer} ${currentNode === NODE.SHOW_RECOMMENDATION ? styles.choicesCentered : styles.choicesEven}`}>
            {renderChoices()}
          </div>

        </div>
      </div>
    </>
  );
}
