
from fastapi import APIRouter

from app.schemas.grievance import GrievanceRequest
from app.schemas.grievance_response import GrievanceResponse
from app.controllers.grievance_controller import (
    handle_grievance_prediction
)


router = APIRouter(
    prefix="/grievances",
    tags=["Grievances"]
)


@router.post("/predict",response_model=GrievanceResponse)
def predict_grievance_route(
    grievance: GrievanceRequest
):

    result = handle_grievance_prediction(grievance)

    return result