
from app.database import get_database_connection


def save_prediction(
    grievance_text: str,
    predicted_category: str,
    confidence: float,
    needs_human_review: bool
):
    """
    Save a grievance prediction into MySQL.
    """

    connection = None
    cursor = None

    try:
        # 1. Create database connection
        connection = get_database_connection()

        if connection is None or not connection.is_connected():
            raise Exception("Database connection could not be established.")

        # 2. Create cursor
        cursor = connection.cursor()

        # 3. SQL query with placeholders
        query = """
            INSERT INTO prediction_history (
                grievance_text,
                predicted_category,
                confidence,
                needs_human_review
            )
            VALUES (%s, %s, %s, %s)
        """

        # 4. Values inserted safely through parameters
        values = (
            grievance_text,
            predicted_category,
            confidence,
            needs_human_review
        )

        # 5. Execute the query
        cursor.execute(query, values)

        # 6. Save changes permanently
        connection.commit()

        # 7. Return the inserted record ID
        prediction_id = cursor.lastrowid

        return prediction_id

    except Exception as error:
        # Undo uncommitted database changes
        if connection is not None and connection.is_connected():
            connection.rollback()

        raise Exception(f"Could not save prediction: {error}")

    finally:
        # Close cursor
        if cursor is not None:
            cursor.close()

        # Close connection
        if connection is not None and connection.is_connected():
            connection.close()