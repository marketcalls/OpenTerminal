# Open Terminal - Trading Dashboard

Open Terminal is a Flask-based application for traders that provides a secure login system using AngelOne API, registration, and a protected dashboard. The app utilizes SQLite for database management, Flask-SQLAlchemy for ORM, and Redis for caching.

## Features

### Core Features
- **User Registration**: Users can register by providing their username, client ID, and API key
- **Login Authentication**: Secure login using AngelOne's API, with session management and access token storage
- **Protected Dashboard**: Accessible only to authenticated users

### Trading Features
- **Watchlists**: Create, update, and delete watchlists (up to 5 per user)
- **Watchlist Items**: Add, remove, and manage items in watchlists
- **Real-time Data**: Display of real-time market data for watchlist items
- **Market Depth**: Level 2 order book display
- **Search Functionality**: Search for symbols to add to watchlists
- **Market Indices**: Display of NIFTY and SENSEX indices

### User Experience
- **Customizable Settings**: Users can customize their watchlist display settings
- **Secure Logout**: Removes the access token from the database and logs the user out
- **Modern UI**: Uses Tailwind CSS and DaisyUI for a consistent, modern interface

## Technology Stack

### Backend
- **Framework**: Flask, Flask-SQLAlchemy, Flask-Login, Flask-WTF
- **Database**: SQLite
- **Caching**: Redis
- **API Integration**: AngelOne API for user authentication and market data
- **Task Scheduling**: APScheduler
- **Timezone**: pytz for timezone handling

### Frontend
- **CSS Framework**: Tailwind CSS
- **UI Components**: DaisyUI
- **JavaScript**: Modern ES6+ with modular architecture
- **Real-time Updates**: WebSocket integration

## Project Structure

```bash
openterminal/
├── app.py                # Application entry point
├── config.py             # Flask configuration
├── extensions.py         # Database and extensions
├── master_contract.py    # Market data handling
├── models.py             # Database models
├── triggerdb.py         # Database triggers
├── routes/              
│   ├── auth.py          # Authentication routes
│   ├── dashboard.py     # Dashboard management
│   ├── funds.py         # Funds routes
│   ├── home.py          # Home routes
│   └── orders.py        # Order management
├── static/             
│   └── js/
│       ├── dashboard.js       # Main dashboard logic
│       └── modules/
│           ├── marketDataUpdater.js  # Real-time updates
│           └── watchlistManager.js   # Watchlist operations
├── templates/           # HTML templates
└── requirements.txt     # Dependencies
```

## Installation

### Prerequisites
- Python 3.9+
- Redis Server
- Git

### Setup Steps

1. **Clone the repository:**
```bash
git clone https://github.com/marketcalls/OpenTerminal.git
cd OpenTerminal
```

2. **Create virtual environment:**
```bash
python -m venv venv
```

3. **Activate virtual environment:**
```bash
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

4. **Install dependencies:**
```bash
pip install -r requirements.txt
```

5. **Configure Redis:**
- Install Redis on your system if not already installed
- Ensure Redis server is running

6. **Run application:**
```bash
python app.py
```

7. Access at `http://127.0.0.1:5000`

Note: The SQLite database will be created automatically when you first run the application.

## Environment Variables

Create a `.env` file with:
```env
SECRET_KEY=your-secret-key
SQLALCHEMY_DATABASE_URI=sqlite:///open_terminal.db
REDIS_URL=redis://localhost:6379/0
```

## Usage Guide

1. **Registration**
   - Visit `/register`
   - Provide required credentials

2. **Login**
   - Use client ID, PIN, and TOTP
   - Access granted to dashboard

3. **Dashboard Features**
   - Manage watchlists (up to 5)
   - Add/remove symbols
   - View real-time data
   - Customize settings
   - Monitor market indices

4. **Additional Features**
   - Access funds information
   - View holdings
   - Check order book
   - Monitor positions
   - Review trade book

5. **Logout**
   - Secure session termination
   - Token cleanup

## Development Status

Open Terminal is under active development with regular updates and improvements. Users should expect ongoing enhancements and potential changes as the platform evolves.

## Future Features

- Comprehensive trading functionality
- Advanced charting capabilities
- Multi-broker integration
- Backtesting tools
- Strategy building features

## Contributing

We welcome contributions! For major changes:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Open an issue for discussion

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

Key requirements:
- Source code availability for modifications
- Network use considered as distribution
- Modifications must maintain AGPL-3.0 license
- See [LICENSE](LICENSE) file for complete terms

---
Developed with passion for the trading community