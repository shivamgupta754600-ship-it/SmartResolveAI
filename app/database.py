import os
import mysql.connector
from dotenv import load_dotenv

# Load environment variables from the project-root .env file
load_dotenv()

def get_database_connection():
    """Create and return a MySQL database connection."""
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE", "smartresolve_db")
    )