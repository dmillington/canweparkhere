import json

from django.shortcuts import render
from django.shortcuts import render_to_response
from django.http import HttpResponse
from cwph.map.models import ParkingSpot, ParkingRule

def home(request):
    return render_to_response('index.html')

def map(request):
    return render_to_response('map.html')

def get_parking_spots(request):
    # Return parking spots and their associated rules.
    # We only want to expose the data the client needs. No primary keys, data types, etc.
    parking_spots = ParkingSpot.objects.all()
    for ps in parking_spots:
        ps.rules = [{'rule': o.rule,
                                'start_time': str(o.start_time),
                                'end_time': str(o.end_time),
                                'time_limit': o.time_limit,
                                'zone_number': o.zone_number,
                                'zone_limit_other': o.zone_limit_other,
                                'days_of_the_week': o.days_of_the_week,
                                'supports_holidays': o.supports_holidays,
                                'hourly_rate': str(o.hourly_rate)}
                                for o in ParkingRule.objects.filter(parking_spot = ps)]
    ps_json = json.dumps( [{'s_lat': o.s_lat,
                           's_lng': o.s_lng,
                           'e_lat': o.e_lat,
                           'e_lng': o.e_lng,
                           'rules': o.rules}
                           for o in parking_spots] )
    return HttpResponse(ps_json, content_type="application/json")
