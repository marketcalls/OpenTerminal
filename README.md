# Open Terminal - Trading Dashboard

Open Terminal is a Flask-based trading dashboard that provides a secure, feature-rich platform for traders using AngelOne API. It offers real-time market data, watchlist management, and comprehensive trading capabilities.

## Key Features

### Trading Features
- **Real-time Market Data**: Live streaming of market prices and depth
- **Watchlist Management**: Create and manage up to 5 watchlists
- **Order Management**: Place, modify, and track orders
- **Portfolio Overview**: View holdings, positions, and P&L
- **Market Depth**: Level 2 order book display
- **Symbol Search**: Extensive search functionality for adding instruments

### Technical Features
- **Secure Authentication**: AngelOne API integration for secure login
- **WebSocket Integration**: Real-time data updates
- **Redis Caching**: Optimized performance with Redis
- **Modular Architecture**: Well-organized, maintainable codebase
- **Responsive Design**: Modern UI using Tailwind CSS and DaisyUI

## Technology Stack

### Backend
- Flask & Flask extensions (SQLAlchemy, Login, WTF)
- SQLite Database
- Redis for caching
- WebSocket for real-time data
- APScheduler for task scheduling

### Frontend
- Tailwind CSS with DaisyUI
- Modern JavaScript (ES6+)
- Modular component architecture
- WebSocket client integration

## Quick Start

### Prerequisites
- Python 3.9+
- Redis Server
- Git

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/marketcalls/OpenTerminal.git
cd OpenTerminal
```

2. **Set up Python environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. **Configure environment:**
Create `.env` file with:
```env
SECRET_KEY=your-secret-key
SQLALCHEMY_DATABASE_URI=sqlite:///open_terminal.db
REDIS_URL=redis://localhost:6379/0
```

4. **Start Redis server**

5. **Run the application:**
```bash
python app.py
```

Access at `http://127.0.0.1:5000`

## Project Structure

```
openterminal/
├── app.py              # Application entry point
├── config.py           # Configuration settings
├── extensions.py       # Flask extensions
├── models.py          # Database models
├── routes/            # Route modules
│   ├── auth.py        # Authentication
│   ├── dashboard/     # Dashboard features
│   └── orders/        # Order management
├── static/            # Static assets
│   ├── css/          # Stylesheets
│   └── js/           # JavaScript modules
└── templates/         # HTML templates
```

## Development

### Code Organization
- **Routes**: Organized by feature in separate modules
- **Services**: Business logic separated from routes
- **Models**: SQLAlchemy models for data structure
- **Static**: Modular JavaScript and CSS assets
- **Templates**: Jinja2 templates with component structure

### Best Practices
- Follows Flask application factory pattern
- Implements proper error handling
- Uses type hints and docstrings
- Maintains consistent code style
- Includes comprehensive logging

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed production deployment instructions.

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

See [LICENSE](LICENSE) file for complete terms.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Open an issue for discussion

---
Built with ❤️ for the trading community
