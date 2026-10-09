
from app.repositories.prediction import save_prediction


try:
    prediction_id = save_prediction(
        grievance_text="हमारे इलाके में पानी नहीं आ रहा है",
        predicted_category="water_supply",
        confidence=0.7745,
        needs_human_review=False
    )

    print("Prediction saved successfully!")
    print("Inserted prediction ID:", prediction_id)

except Exception as error:
    print("Repository test failed:", error)