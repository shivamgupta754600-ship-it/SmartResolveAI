from app.database import get_database_connection


connection = get_database_connection()


if connection is not None and connection.is_connected():
    print("Database test passed!")

    connection.close()
    print("MySQL connection closed.")
else:
    print("Database test failed.")