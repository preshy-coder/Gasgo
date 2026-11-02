from math import asin, cos, radians, sin, sqrt


SERVICE_AREA = {"lat": -1.1018, "lng": 37.0144, "radius_km": 10}

OUTSIDE_AREA_MESSAGE = (
    "Gasgo currently delivers within Juja, Kiambu County only. Move the pin to a location in Juja."
)


def distance_km(lat1, lng1, lat2, lng2):
    """Straight-line distance between two points on Earth (haversine)."""
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    a = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lng2 - lng1) / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


def in_service_area(lat, lng):
    return distance_km(lat, lng, SERVICE_AREA["lat"], SERVICE_AREA["lng"]) <= SERVICE_AREA["radius_km"]