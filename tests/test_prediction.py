
from app.services.prediction import predict_grievance


# TEST 1: VALID HINDI INPUT

print("\n TEST 1: VALID HINDI INPUT ")

try:
    result = predict_grievance(
        "हमारे इलाके में पानी नहीं आ रहा है"
    )

    print(result)

except Exception as error:
    print("Error:", error)


# TEST 2: VALID ENGLISH INPUT

print("\n TEST 2: VALID ENGLISH INPUT ")

try:
    result = predict_grievance(
        "There is no lighting near the public park"
    )

    print(result)

except Exception as error:
    print("Error:", error)


# TEST 3: EMPTY INPUT

print("\n TEST 3: EMPTY INPUT ")

try:
    result = predict_grievance("")

    print(result)

except Exception as error:
    print("Expected validation error:", error)


# TEST 4: VERY SHORT INPUT

print("\n TEST 4: VERY SHORT INPUT ")

try:
    result = predict_grievance("Help")

    print(result)

except Exception as error:
    print("Expected validation error:", error)


# TEST 5: TOO LONG INPUT

print("\n TEST 5: TOO LONG INPUT ")

try:
    long_text = "water problem " * 100

    result = predict_grievance(long_text)

    print(result)

except Exception as error:
    print("Expected validation error:", error)