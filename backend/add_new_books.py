"""
add_new_books.py
------------------
Seeds the requested 70 books (Non-Fiction Bestsellers, Thrillers, and Indian Authors shelf)
with proper author names, ISBN numbers, ratings, descriptions, categories, and downloads their cover images.
"""

import os
import time
from app.extensions import db
from app.models.book import Book, Author, Category
from download_all_covers import process_book, app

BOOKS_DATA = [
    # --- Non-Fiction & Self-Help Bestsellers ---
    {
        "title": "Rich Dad Poor Dad",
        "author": "Robert Kiyosaki",
        "category": "Self-Help",
        "isbn": "9780143453613",
        "rating": 4.7,
        "description": "What the rich teach their kids about money that the poor and middle class do not. A personal finance classic that challenges conventional wisdom on wealth and investing.",
        "cover_color": "#10b981"
    },
    {
        "title": "The Subtle Art of Not Giving a Fck*",
        "author": "Mark Manson",
        "category": "Self-Help",
        "isbn": "9780062457714",
        "rating": 4.5,
        "description": "A counterintuitive approach to living a good life, arguing that improving our lives hinges not on our ability to turn lemons into lemonade, but on learning to stomach lemons better.",
        "cover_color": "#f97316"
    },
    {
        "title": "Atomic Habits",
        "author": "James Clear",
        "category": "Self-Help",
        "isbn": "9780735211292",
        "rating": 4.8,
        "description": "An easy and proven way to build good habits and break bad ones. Learn how tiny changes can lead to remarkable results in health, wealth, and productivity.",
        "cover_color": "#3b82f6"
    },
    {
        "title": "Ikigai: The Japanese Secret to a Long and Happy Life",
        "author": "Héctor García & Francesc Miralles",
        "category": "Self-Help",
        "isbn": "9780143130727",
        "rating": 4.6,
        "description": "Discover the Japanese secret to a long and happy life. Find your ikigai—your reason for jumping out of bed every morning—and transform your daily routines.",
        "cover_color": "#ec4899"
    },
    {
        "title": "Sapiens: A Brief History of Humankind",
        "author": "Yuval Noah Harari",
        "category": "Non-Fiction",
        "isbn": "9780062316097",
        "rating": 4.8,
        "description": "A groundbreaking narrative of humanity's creation and evolution that explores how biology and history have defined us and enhanced our understanding of what it means to be human.",
        "cover_color": "#8b5cf6"
    },
    {
        "title": "The Power of Your Subconscious Mind",
        "author": "Joseph Murphy",
        "category": "Self-Help",
        "isbn": "9788194790839",
        "rating": 4.6,
        "description": "Unlock the extraordinary powers of your subconscious mind to change your life, overcome phobias, build wealth, and achieve true inner peace.",
        "cover_color": "#6366f1"
    },
    {
        "title": "Think and Grow Rich",
        "author": "Napoleon Hill",
        "category": "Self-Help",
        "isbn": "9781585424337",
        "rating": 4.7,
        "description": "The landmark bestseller on wealth and success, synthesizing the wisdom of America's most successful millionaires into thirteen proven steps to riches.",
        "cover_color": "#eab308"
    },
    {
        "title": "How to Win Friends and Influence People",
        "author": "Dale Carnegie",
        "category": "Self-Help",
        "isbn": "9780671027032",
        "rating": 4.8,
        "description": "The time-tested advice and human relations principles that have carried millions of people up the ladder of success in their business and personal lives.",
        "cover_color": "#14b8a6"
    },
    {
        "title": "The 7 Habits of Highly Effective People",
        "author": "Stephen Covey",
        "category": "Self-Help",
        "isbn": "9780743269513",
        "rating": 4.7,
        "description": "A holistic, integrated, principle-centered approach for solving personal and professional problems by adapting to change and taking advantage of opportunities.",
        "cover_color": "#06b6d4"
    },
    {
        "title": "The Psychology of Money",
        "author": "Morgan Housel",
        "category": "Non-Fiction",
        "isbn": "9780857197689",
        "rating": 4.8,
        "description": "Timeless lessons on wealth, greed, and happiness doing well with money isn't necessarily about what you know; it's about how you behave.",
        "cover_color": "#10b981"
    },
    {
        "title": "Educated",
        "author": "Tara Westover",
        "category": "Non-Fiction",
        "isbn": "9780399590504",
        "rating": 4.7,
        "description": "An unforgettable memoir about a young girl who, kept out of school by her survivalist family, goes on to earn a PhD from Cambridge University.",
        "cover_color": "#f43f5e"
    },
    {
        "title": "Man's Search for Meaning",
        "author": "Viktor Frankl",
        "category": "Non-Fiction",
        "isbn": "9780807014295",
        "rating": 4.9,
        "description": "Psychiatrist Viktor Frankl's riveting memoir of life in Nazi death camps and his lesson for spiritual survival through finding meaning in suffering.",
        "cover_color": "#64748b"
    },
    {
        "title": "Can't Hurt Me",
        "author": "David Goggins",
        "category": "Non-Fiction",
        "isbn": "9781544512280",
        "rating": 4.8,
        "description": "Master your mind and defy the odds. The incredible story of David Goggins' transformation from a depressed, overweight young man into a U.S. Armed Forces icon.",
        "cover_color": "#334155"
    },
    {
        "title": "The Alchemist",
        "author": "Paulo Coelho",
        "category": "Fiction",
        "isbn": "9780062315007",
        "rating": 4.7,
        "description": "An enchanting fable about Santiago, an Andalusian shepherd boy who yearns to travel in search of a worldly treasure, learning to listen to his heart along the way.",
        "cover_color": "#d97706"
    },
    {
        "title": "12 Rules for Life",
        "author": "Jordan Peterson",
        "category": "Self-Help",
        "isbn": "9780345816023",
        "rating": 4.6,
        "description": "An antidote to chaos offering twelve profound and practical principles for living a meaningful life, drawing on mythology, psychology, and personal anecdotes.",
        "cover_color": "#475569"
    },
    {
        "title": "Deep Work",
        "author": "Cal Newport",
        "category": "Self-Help",
        "isbn": "9781455586691",
        "rating": 4.7,
        "description": "Rules for focused success in a distracted world. Master the skill of deep work to achieve extraordinary results in less time.",
        "cover_color": "#0284c7"
    },
    {
        "title": "Outliers",
        "author": "Malcolm Gladwell",
        "category": "Non-Fiction",
        "isbn": "9780316017930",
        "rating": 4.6,
        "description": "An exploration of the secrets of high achievers, looking beyond intelligence and ambition to cultural background, timing, and the famous 10,000-hour rule.",
        "cover_color": "#7c3aed"
    },
    {
        "title": "Zero to One",
        "author": "Peter Thiel",
        "category": "Non-Fiction",
        "isbn": "9780804139298",
        "rating": 4.6,
        "description": "Notes on startups, or how to build the future. A fresh look at innovation, showing how companies can leap beyond competition by creating something entirely new.",
        "cover_color": "#2563eb"
    },
    {
        "title": "The Lean Startup",
        "author": "Eric Ries",
        "category": "Non-Fiction",
        "isbn": "9780307887894",
        "rating": 4.6,
        "description": "How today's entrepreneurs use continuous innovation to create radically successful businesses through rapid experimentation and validated learning.",
        "cover_color": "#059669"
    },
    {
        "title": "A Brief History of Time",
        "author": "Stephen Hawking",
        "category": "Non-Fiction",
        "isbn": "9780553380163",
        "rating": 4.8,
        "description": "A landmark volume in science writing that explores fundamental questions about the universe, black holes, the Big Bang, and the nature of time itself.",
        "cover_color": "#1e40af"
    },

    # --- Popular Thrillers & Modern Fiction ---
    {
        "title": "Gone Girl",
        "author": "Gillian Flynn",
        "category": "Mystery",
        "isbn": "9780307588371",
        "rating": 4.5,
        "description": "On the occasion of his fifth wedding anniversary, Nick Dunne reports that his beautiful wife, Amy, has gone missing. A psychological thriller full of dark twists.",
        "cover_color": "#be123c"
    },
    {
        "title": "The Girl on the Train",
        "author": "Paula Hawkins",
        "category": "Mystery",
        "isbn": "9781594634024",
        "rating": 4.3,
        "description": "Rachel catches the same commuter train every morning, observing a couple on their deck. But then she witnesses something shocking that entangles her in a mystery.",
        "cover_color": "#4c0519"
    },
    {
        "title": "Where the Crawdads Sing",
        "author": "Delia Owens",
        "category": "Fiction",
        "isbn": "9780735219090",
        "rating": 4.8,
        "description": "For years, rumors of the 'Marsh Girl' haunted Barkley Cove. An ode to the natural world and a heartbreaking coming-of-age story wrapped in a murder mystery.",
        "cover_color": "#15803d"
    },
    {
        "title": "The Silent Patient",
        "author": "Alex Michaelides",
        "category": "Mystery",
        "isbn": "9781250301697",
        "rating": 4.6,
        "description": "Alicia Berenson's life is seemingly perfect until she shoots her husband five times and never speaks another word. A criminal psychotherapist becomes obsessed with uncovering the truth.",
        "cover_color": "#312e81"
    },
    {
        "title": "It",
        "author": "Stephen King",
        "category": "Mystery",
        "isbn": "9781501142970",
        "rating": 4.7,
        "description": "In Derry, Maine, seven adults return to their hometown to confront an evil shapeshifting entity that preyed on them as teenagers.",
        "cover_color": "#991b1b"
    },
    {
        "title": "The Shining",
        "author": "Stephen King",
        "category": "Mystery",
        "isbn": "9780307743657",
        "rating": 4.8,
        "description": "Jack Torrance becomes winter caretaker at the isolated Overlook Hotel, where sinister supernatural forces influence him toward violence against his family.",
        "cover_color": "#b91c1c"
    },
    {
        "title": "The Da Vinci Code",
        "author": "Dan Brown",
        "category": "Mystery",
        "isbn": "9780307474278",
        "rating": 4.6,
        "description": "Symbologist Robert Langdon investigates a murder in the Louvre Museum and uncovers a baffling religious mystery protected by a secret society for centuries.",
        "cover_color": "#854d0e"
    },
    {
        "title": "Angels & Demons",
        "author": "Dan Brown",
        "category": "Mystery",
        "isbn": "9780671027360",
        "rating": 4.6,
        "description": "Robert Langdon is summoned to a Swiss research facility to analyze a mysterious symbol seared into the chest of a murdered physicist, pointing to the Illuminati.",
        "cover_color": "#713f12"
    },
    {
        "title": "And Then There Were None",
        "author": "Agatha Christie",
        "category": "Mystery",
        "isbn": "9780062073488",
        "rating": 4.8,
        "description": "Ten strangers are lured to an isolated island mansion by a mysterious host. One by one, they are accused of past crimes and murdered in accordance with a nursery rhyme.",
        "cover_color": "#1e293b"
    },
    {
        "title": "The Girl with the Dragon Tattoo",
        "author": "Stieg Larsson",
        "category": "Mystery",
        "isbn": "9780307949486",
        "rating": 4.6,
        "description": "Disgraced financial journalist Mikael Blomkvist and tattooed computer hacker Lisbeth Salander investigate the decades-old disappearance of a wealthy industrialist's niece.",
        "cover_color": "#0f172a"
    },

    # --- Indian Authors Section (Dedicated Shelf) ---
    # Fiction & Literary
    {
        "title": "The God of Small Things",
        "author": "Arundhati Roy",
        "category": "Indian Literature",
        "isbn": "9780812979657",
        "rating": 4.8,
        "description": "The Booker Prize-winning masterpiece set in Kerala, chronicling the childhood experiences of fraternal twins whose family lives are destroyed by love laws and politics.",
        "cover_color": "#047857"
    },
    {
        "title": "A Suitable Boy",
        "author": "Vikram Seth",
        "category": "Indian Literature",
        "isbn": "9780060786526",
        "rating": 4.6,
        "description": "Set in newly post-independence, post-partition India, a panoramic epic following four families as a mother searches for a suitable husband for her daughter Lata.",
        "cover_color": "#b45309"
    },
    {
        "title": "The Namesake",
        "author": "Jhumpa Lahiri",
        "category": "Indian Literature",
        "isbn": "9780618485222",
        "rating": 4.6,
        "description": "The story of the Ganguli family, moving between Kolkata and Boston, as son Gogol struggles with his identity and his unusual namesake, Nikolai Gogol.",
        "cover_color": "#c2410c"
    },
    {
        "title": "The Inheritance of Loss",
        "author": "Kiran Desai",
        "category": "Indian Literature",
        "isbn": "9780802142818",
        "rating": 4.5,
        "description": "A Booker Prize-winning novel exploring colonial legacies, migration, and identity through an embittered judge in Kalimpong and his granddaughter Sai.",
        "cover_color": "#4d7c0f"
    },
    {
        "title": "Midnight's Children",
        "author": "Salman Rushdie",
        "category": "Indian Literature",
        "isbn": "9780812976533",
        "rating": 4.7,
        "description": "Saleem Sinai is born at the exact moment of India's independence, endowed with telepathic powers that link him to 1,000 other magical midnight's children.",
        "cover_color": "#1e3a8a"
    },
    {
        "title": "Train to Pakistan",
        "author": "Khushwant Singh",
        "category": "Indian Literature",
        "isbn": "9780143065883",
        "rating": 4.7,
        "description": "A poignant and harrowing historical novel set in the summer of 1947 during the Partition of India, focusing on the fictional border village of Mano Majra.",
        "cover_color": "#7f1d1d"
    },
    {
        "title": "The White Tiger",
        "author": "Aravind Adiga",
        "category": "Indian Literature",
        "isbn": "9781416562603",
        "rating": 4.6,
        "description": "Balram Halwai tells his darkly satirical story of rising from village tea-shop boy to successful entrepreneur in Bangalore through cunning and murder.",
        "cover_color": "#a16207"
    },
    {
        "title": "Interpreter of Maladies",
        "author": "Jhumpa Lahiri",
        "category": "Indian Literature",
        "isbn": "9780395927205",
        "rating": 4.7,
        "description": "Pulitzer Prize-winning collection of short stories exploring the lives of Indians and Indian-Americans caught between traditions and new horizons.",
        "cover_color": "#4338ca"
    },
    {
        "title": "Malgudi Days",
        "author": "R.K. Narayan",
        "category": "Indian Literature",
        "isbn": "9780143039655",
        "rating": 4.8,
        "description": "Classic short stories set in the enchanting fictional South Indian town of Malgudi, capturing the simple joys and poignant dilemmas of everyday Indian life.",
        "cover_color": "#15803d"
    },
    {
        "title": "The Guide",
        "author": "R.K. Narayan",
        "category": "Indian Literature",
        "isbn": "9780143414980",
        "rating": 4.7,
        "description": "Raju, a corrupt tourist guide in Malgudi, falls in love with a dancer, goes to prison, and upon release is mistakenly revered by villagers as a holy man and drought savior.",
        "cover_color": "#b45309"
    },

    # Mythology & Historical Fiction
    {
        "title": "The Immortals of Meluha",
        "author": "Amish Tripathi",
        "category": "Mythology",
        "isbn": "9789380658742",
        "rating": 4.7,
        "description": "The first book of the Shiva Trilogy. Set in 1900 BC Meluha, where Shiva, a Tibetan tribal leader, is drawn into a legendary destiny as the savior Neelkanth.",
        "cover_color": "#b91c1c"
    },
    {
        "title": "Sita: Warrior of Mithila",
        "author": "Amish Tripathi",
        "category": "Mythology",
        "isbn": "9789386224583",
        "rating": 4.6,
        "description": "The second book of the Ram Chandra Series, portraying Sita not as a passive princess, but as a fierce warrior, Prime Minister, and goddess in her own right.",
        "cover_color": "#c2410c"
    },
    {
        "title": "The Palace of Illusions",
        "author": "Chitra Banerjee Divakaruni",
        "category": "Mythology",
        "isbn": "9781400096206",
        "rating": 4.8,
        "description": "A breathtaking retelling of the Hindu epic Mahabharata from the perspective of Panchali (Draupadi), exploring her friendship with Krishna and secret attraction to Karna.",
        "cover_color": "#7c3aed"
    },
    {
        "title": "Ashoka: The Great",
        "author": "Anuja Chandramouli",
        "category": "Mythology",
        "isbn": "9788129134981",
        "rating": 4.5,
        "description": "A compelling biographical novel bringing to life Emperor Ashoka, tracing his transformation from a ruthless conqueror to a legendary Buddhist patron of peace.",
        "cover_color": "#854d0e"
    },
    {
        "title": "Karna's Wife",
        "author": "Kavita Kane",
        "category": "Mythology",
        "isbn": "9788129124814",
        "rating": 4.6,
        "description": "The tragic story of Karna, the unsung hero of the Mahabharata, told through the eyes of his wife Uruvi, who chooses him over royalty despite his social standing.",
        "cover_color": "#be123c"
    },
    {
        "title": "Ajaya: Roll of the Dice",
        "author": "Anand Neelakantan",
        "category": "Mythology",
        "isbn": "9788184955170",
        "rating": 4.6,
        "description": "The Mahabharata told from the viewpoint of the Kauravas. A groundbreaking counter-perspective on Duryodhana, whom the author presents as a progressive leader.",
        "cover_color": "#431407"
    },

    # Popular / Commercial Fiction
    {
        "title": "Five Point Someone",
        "author": "Chetan Bhagat",
        "category": "Indian Literature",
        "isbn": "9788129135490",
        "rating": 4.4,
        "description": "What not to do at IIT. Three friends struggle to cope with the rigorous academic pressure and grade-obsessed system of India's premier engineering institute.",
        "cover_color": "#0284c7"
    },
    {
        "title": "2 States",
        "author": "Chetan Bhagat",
        "category": "Indian Literature",
        "isbn": "9788129135520",
        "rating": 4.5,
        "description": "The story of Krish from Punjab and Ananya from Tamil Nadu who fall in love at IIM Ahmedabad and face the hilarious uphill battle of convincing their conservative parents.",
        "cover_color": "#e11d48"
    },
    {
        "title": "Half Girlfriend",
        "author": "Chetan Bhagat",
        "category": "Indian Literature",
        "isbn": "9788129135728",
        "rating": 4.2,
        "description": "Madhav, a Bihari boy with poor English, falls in love with Riya, a wealthy Delhi girl who agrees to be his 'half girlfriend.'",
        "cover_color": "#db2777"
    },
    {
        "title": "One Night @ the Call Center",
        "author": "Chetan Bhagat",
        "category": "Indian Literature",
        "isbn": "9788129135513",
        "rating": 4.3,
        "description": "Six call center employees in Gurgaon face personal and professional crises during a stressful night shift, culminating in a mysterious phone call from God.",
        "cover_color": "#0891b2"
    },
    {
        "title": "I Too Had a Love Story",
        "author": "Ravinder Singh",
        "category": "Indian Literature",
        "isbn": "9780143418766",
        "rating": 4.5,
        "description": "A heartbreaking autobiographical romance about Ravin and Khushi, who meet on a matrimonial site and fall deeply in love before tragedy strikes.",
        "cover_color": "#be123c"
    },
    {
        "title": "Of Course I Love You",
        "author": "Durjoy Datta",
        "category": "Indian Literature",
        "isbn": "9780143421575",
        "rating": 4.2,
        "description": "A story set in Delhi College of Engineering following Deb, an unabashed Casanova whose perspective on love and relationships changes when he meets Avantika.",
        "cover_color": "#9333ea"
    },
    {
        "title": "Life Is What You Make It",
        "author": "Preeti Shenoy",
        "category": "Indian Literature",
        "isbn": "9789380349305",
        "rating": 4.5,
        "description": "A gripping story of Ankita, who has everything going for her until she is struck by bipolar disorder, and her courageous journey back to mental wellness and hope.",
        "cover_color": "#059669"
    },
    {
        "title": "The Bankster",
        "author": "Ravi Subramanian",
        "category": "Indian Literature",
        "isbn": "9788129120489",
        "rating": 4.4,
        "description": "A high-stakes financial thriller involving international money laundering, nuclear secrets, and corporate intrigue set inside a global retail bank in Mumbai.",
        "cover_color": "#334155"
    },
    {
        "title": "Ladies Coupe",
        "author": "Anita Nair",
        "category": "Indian Literature",
        "isbn": "9780143028086",
        "rating": 4.6,
        "description": "Akhila, a forty-five-year-old spinster, embarks on a train journey to Kanyakumari in a women-only compartment, sharing intimate stories of love, marriage, and freedom with five passengers.",
        "cover_color": "#a21caf"
    },

    # Sudha Murty Collection
    {
        "title": "Wise and Otherwise",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143062226",
        "rating": 4.8,
        "description": "Fifty vignettes from Sudha Murty's vast travels across India as a social worker, showcasing extraordinary acts of kindness and human nature in everyday life.",
        "cover_color": "#d97706"
    },
    {
        "title": "House of Cards",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143420257",
        "rating": 4.6,
        "description": "The story of Mridula and Sanjay, whose idealistic marriage in Bangalore is tested by greed, ambition, and the corrupting power of sudden corporate wealth.",
        "cover_color": "#047857"
    },
    {
        "title": "Grandma's Bag of Stories",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143333649",
        "rating": 4.9,
        "description": "Delightful tales told by a grandmother to her visiting grandchildren in Shiggaon, filled with magical animals, kings, and timeless morals.",
        "cover_color": "#eab308"
    },
    {
        "title": "Three Thousand Stitches",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143440057",
        "rating": 4.8,
        "description": "An inspiring collection of real-life experiences, including Sudha Murty's transformative work empowering devadasis in Karnataka and breaking gender barriers at TELCO.",
        "cover_color": "#4f46e5"
    },
    {
        "title": "Dollar Bahu",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143031024",
        "rating": 4.6,
        "description": "A poignant family drama exploring Indian obsession with America and the dollar, showing how material wealth cannot substitute for genuine love and respect.",
        "cover_color": "#16a34a"
    },
    {
        "title": "Gently Falls the Bakula",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143063032",
        "rating": 4.7,
        "description": "A touching story of Shrimati and Shrikant, exploring the sacrifices a wife makes for her husband's corporate ambition and her search for her own identity.",
        "cover_color": "#db2777"
    },
    {
        "title": "How I Taught My Grandmother to Read",
        "author": "Sudha Murty",
        "category": "Indian Literature",
        "isbn": "9780143333632",
        "rating": 4.8,
        "description": "A heartwarming collection of memories and short stories from Sudha Murty's childhood and life, teaching values of honesty, reading, and empathy.",
        "cover_color": "#ea580c"
    },

    # Non-Fiction & Memoir
    {
        "title": "Wings of Fire",
        "author": "A.P.J. Abdul Kalam",
        "category": "Non-Fiction",
        "isbn": "9788173711466",
        "rating": 4.9,
        "description": "The inspiring autobiography of Dr. A.P.J. Abdul Kalam, tracing his journey from a humble boat owner's son in Rameswaram to India's 'Missile Man' and President.",
        "cover_color": "#ea580c"
    },
    {
        "title": "India After Gandhi",
        "author": "Ramachandra Guha",
        "category": "Non-Fiction",
        "isbn": "9780330505543",
        "rating": 4.8,
        "description": "A monumental, acclaimed history of the world's largest democracy since achieving independence in 1947, detailing its political, social, and cultural triumphs and trials.",
        "cover_color": "#15803d"
    },
    {
        "title": "The Argumentative Indian",
        "author": "Amartya Sen",
        "category": "Non-Fiction",
        "isbn": "9780374105839",
        "rating": 4.7,
        "description": "Nobel Prize-winning economist Amartya Sen explores India's long intellectual tradition of public debate, pluralism, and intellectual diversity throughout history.",
        "cover_color": "#1e40af"
    },
    {
        "title": "Playing It My Way",
        "author": "Sachin Tendulkar",
        "category": "Non-Fiction",
        "isbn": "9781473605176",
        "rating": 4.8,
        "description": "The definitive autobiography of the 'God of Cricket,' recounting Sachin Tendulkar's legendary 24-year international career and his journey from Mumbai to world glory.",
        "cover_color": "#0284c7"
    },
    {
        "title": "An Era of Darkness",
        "author": "Shashi Tharoor",
        "category": "Non-Fiction",
        "isbn": "9789383064656",
        "rating": 4.8,
        "description": "A devastating, meticulously researched critique of the British Raj in India, dismantling myths of colonial benevolence and detailing the economic looting of a subcontinent.",
        "cover_color": "#7f1d1d"
    },
    {
        "title": "Why I Am a Hindu",
        "author": "Shashi Tharoor",
        "category": "Non-Fiction",
        "isbn": "9789386797933",
        "rating": 4.6,
        "description": "Shashi Tharoor explores the rich philosophical concepts of Hinduism, distinguishing its tolerant, pluralistic heritage from modern political Hindutva.",
        "cover_color": "#c2410c"
    },
    {
        "title": "The Difficulty of Being Good",
        "author": "Gurcharan Das",
        "category": "Non-Fiction",
        "isbn": "9780198063269",
        "rating": 4.7,
        "description": "A brilliant examination of moral dilemmas in the epic Mahabharata, applying ancient concepts of dharma to contemporary Indian business, politics, and daily life.",
        "cover_color": "#a16207"
    },
    {
        "title": "Connect the Dots",
        "author": "Rashmi Bansal",
        "category": "Non-Fiction",
        "isbn": "9788190453028",
        "rating": 4.6,
        "description": "Inspiring stories of twenty Indian entrepreneurs who built successful business ventures without an MBA, proving that passion and street smarts trump formal credentials.",
        "cover_color": "#6366f1"
    }
]

def get_or_create_author(name):
    author = Author.query.filter_by(name=name).first()
    if not author:
        author = Author(name=name, bio=f"Acclaimed author of {name}'s bestsellers.")
        db.session.add(author)
        db.session.commit()
    return author

def get_or_create_category(name, color="#8b5cf6"):
    category = Category.query.filter_by(name=name).first()
    if not category:
        category = Category(name=name, color=color, book_count=0)
        db.session.add(category)
        db.session.commit()
    return category

def seed_books():
    print(f"Starting to seed {len(BOOKS_DATA)} books into the database...\n")
    with app.app_context():
        added_count = 0
        updated_count = 0

        for item in BOOKS_DATA:
            author = get_or_create_author(item["author"])
            category = get_or_create_category(item["category"], item["cover_color"])

            # Check by ISBN or Title
            book = Book.query.filter((Book.isbn == item["isbn"]) | (Book.title == item["title"])).first()
            if book:
                book.author_id = author.id
                book.category_id = category.id
                book.rating = item["rating"]
                book.description = item["description"]
                book.cover_color = item["cover_color"]
                if not book.isbn:
                    book.isbn = item["isbn"]
                updated_count += 1
                print(f"[UPDATE] {book.title}")
            else:
                book = Book(
                    title=item["title"],
                    author_id=author.id,
                    category_id=category.id,
                    isbn=item["isbn"],
                    rating=item["rating"],
                    description=item["description"],
                    cover_color=item["cover_color"],
                    total_copies=5,
                    available_copies=5
                )
                db.session.add(book)
                added_count += 1
                print(f"[ADD] {book.title}")

        db.session.commit()

        # Update category counts
        for cat in Category.query.all():
            cat.book_count = Book.query.filter_by(category_id=cat.id).count()
        db.session.commit()

        print(f"\nDatabase seed complete! Added: {added_count}, Updated: {updated_count}")

        # Now download covers for all added/updated books
        print("\nStarting cover image downloads...")
        books_to_process = Book.query.all()
        for i, book in enumerate(books_to_process, 1):
            title_safe = book.title.encode('ascii', 'replace').decode('ascii')
            print(f"[{i}/{len(books_to_process)}] Checking cover for: {title_safe}...")
            process_book(book)
            time.sleep(0.1)

        print("\nAll cover processing finished successfully!")

if __name__ == "__main__":
    seed_books()
