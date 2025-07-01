from app import create_app, schedule_task

# Create the Flask application instance
app = create_app()

# Start the scheduler with the application context
schedule_task(app)

# Keep the script running
try:
    # If you need to perform any periodic tasks within the app context, you can do so here
    app.logger.info("Scheduler started and running.")
    while True:
        pass  # Keep the script alive
except KeyboardInterrupt:
    pass
