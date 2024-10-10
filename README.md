
# Open Terminal - Trading Dashboard

Open Terminal is a Flask-based application for traders that provides a secure login system using AngelOne API, registration, and a protected dashboard. The app utilizes SQLite for database management and Flask-SQLAlchemy for ORM.

## Features

- **User Registration**: Users can register by providing their username, client ID, and API key.
- **Login Authentication**: Secure login using AngelOne's API, with session management and access token storage.
- **Dashboard**: A protected page that is accessible only to authenticated users.
- **Logout**: Removes the access token from the database and logs the user out.
- **Consistent UI**: The app uses Tailwind CSS and DaisyUI for a modern user interface, with a consistent theme across all pages.

## Technology Stack

- **Backend**: Flask, Flask-SQLAlchemy
- **Database**: SQLite
- **Frontend**: Tailwind CSS, DaisyUI
- **API**: AngelOne API for user authentication

## Project Structure

```bash
open_terminal/
├── app.py              # Main application file
├── extensions.py       # Initialize the database and extensions
├── models.py           # User model definition
├── routes.py           # Flask routes (registration, login, logout, dashboard)
├── templates/          # HTML templates
│    ├── layout.html    # Base layout for all pages
│    ├── index.html     # Home page
│    ├── about.html     # About page
│    ├── register.html  # Registration page
│    ├── login.html     # Login page
│    └── dashboard.html # Protected dashboard
├── static/             # Static assets (CSS, JS)
├── config.py           # Configuration for Flask (Database URI, Secret Key)
└── .gitignore          # Files and directories to ignore in version control
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/open-terminal.git
   cd open-terminal
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

6. Run the Flask application:
   ```bash
   python app.py
   ```

7. Navigate to `http://127.0.0.1:5000` to view the application in your browser.

## Environment Variables

- **SECRET_KEY**: A secret key for the Flask session.
- **SQLALCHEMY_DATABASE_URI**: Set to `sqlite:///open_terminal.db` in the current project.

You can set these in your environment or in a `.env` file for development.

## Usage

- **Register** a new user by visiting `/register`.
- **Login** with your client ID, PIN, and TOTP.
- Access the **Dashboard** after login, and **Logout** will clear the session and access token.

## Future Features

- Add more API integrations for real-time trading.
- Implement user settings and trading history.
- Add more protected routes for user-specific actions.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
