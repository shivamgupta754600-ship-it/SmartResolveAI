
from fastapi import HTTPException

from app.schemas.grievance import GrievanceRequest
from app.services.prediction import predict_grievance


def handle_grievance_prediction(
    grievance: GrievanceRequest
) -> dict:

    try:

        # Get validated text from the schema
        text = grievance.text

        # Call the prediction service
        result = predict_grievance(text)

        # Return the prediction result
        return result

    except ValueError as error:

        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    except RuntimeError as error:

        raise HTTPException(
            status_code=503,
            detail=str(error)
        )

    except Exception as error:

        print("Unexpected controller error:", error)

        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred."
        )