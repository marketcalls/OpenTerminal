# Open Terminal - Trading Dashboard

Open Terminal is a Flask-based application for traders that provides a secure login system using AngelOne API, registration, and a protected dashboard. The app utilizes SQLite for database management, Flask-SQLAlchemy for ORM, and Redis for caching.

## Features

- **User Registration**: Users can register by providing their username, client ID, and API key.
- **Login Authentication**: Secure login using AngelOne's API, with session management and access token storage.
- **Dashboard**: A protected page that is accessible only to authenticated users.
- **Watchlists**: Users can create, update, and delete watchlists (up to 5 per user).
- **Watchlist Items**: Add, remove, and manage items in watchlists.
- **Real-time Data**: Display of real-time market data for watchlist items.
- **Search Functionality**: Search for symbols to add to watchlists.
- **Market Indices**: Display of NIFTY and SENSEX indices.
- **Customizable Settings**: Users can customize their watchlist display settings.
- **Logout**: Removes the access token from the database and logs the user out.
- **Consistent UI**: The app uses Tailwind CSS and DaisyUI for a modern user interface, with a consistent theme across all pages.

## Technology Stack

- **Backend**: Flask, Flask-SQLAlchemy, Flask-Login, Flask-WTF
- **Database**: SQLite
- **Caching**: Redis
- **Frontend**: Tailwind CSS, DaisyUI
- **API**: AngelOne API for user authentication
- **Task Scheduling**: APScheduler
- **Other**: pytz for timezone handling

## Project Structure

```bash
openterminal/
├── app.py              # Main application file
├── config.py           # Configuration for Flask (Database URI, Secret Key)
├── extensions.py       # Initialize the database and extensions
├── master_contract.py  # Handling master contract data
├── models.py           # Database models (User, Watchlist, WatchlistItem, Instrument)
├── triggerdb.py        # Database trigger functionality
├── routes/             # Flask routes
│   ├── __init__.py
│   ├── auth.py         # Authentication routes
│   ├── dashboard.py    # Dashboard and watchlist management
│   ├── funds.py        # Funds-related routes
│   ├── home.py         # Home page routes
│   └── orders.py       # Order management routes
├── static/             # Static assets (CSS, JS)
│   └── js/
│       └── dashboard.js # Dashboard JavaScript
├── templates/          # HTML templates
│   ├── layout.html     # Base layout for all pages
│   ├── index.html      # Home page
│   ├── about.html      # About page
│   ├── register.html   # Registration page
│   ├── login.html      # Login page
│   ├── dashboard.html  # Protected dashboard
│   ├── funds.html      # Funds page
│   ├── holdings.html   # Holdings page
│   ├── orderbook.html  # Order book page
│   ├── positions.html  # Positions page
│   └── tradebook.html  # Trade book page
├── requirements.txt    # Python dependencies
└── .gitignore          # Files and directories to ignore in version control
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/marketcalls/OpenTerminal.git
   cd OpenTerminal
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:

   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

5. Set up the SQLite database:
   ```bash
   python -c "from app import app; from extensions import db; app.app_context().push(); db.create_all()"
   ```

6. Set up Redis:
   - Install Redis on your system if not already installed.
   - Ensure Redis server is running.

7. Run the Flask application:
   ```bash
   python app.py
   ```

8. Navigate to `http://127.0.0.1:5000` to view the application in your browser.

## Environment Variables

- **SECRET_KEY**: A secret key for the Flask session.
- **SQLALCHEMY_DATABASE_URI**: Set to `sqlite:///open_terminal.db` in the current project.
- **REDIS_URL**: URL for your Redis instance (e.g., `redis://localhost:6379/0`).

You can set these in your environment or in a `.env` file for development.

## Usage

1. **Register** a new user by visiting `/register`.
2. **Login** with your client ID, PIN, and TOTP.
3. Access the **Dashboard** after login:
   - Create and manage watchlists (up to 5).
   - Add and remove items from watchlists.
   - View real-time market data for watchlist items.
   - Search for symbols to add to watchlists.
   - View market indices (NIFTY and SENSEX).
   - Customize watchlist display settings.
4. Navigate to other sections like Funds, Holdings, Order Book, Positions, and Trade Book.
5. **Logout** will clear the session and access token.

## Future Features

- Implement more comprehensive trading functionality.
- Add advanced charting capabilities.
- Integrate with multiple brokers.
- Implement backtesting and strategy building tools.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
