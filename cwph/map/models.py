from django.db import models

# Create your models here.
class ParkingSpot(models.Model):
    s_lat = models.FloatField()
    s_lng = models.FloatField()
    e_lat = models.FloatField()
    e_lng = models.FloatField()
    
class ParkingRule(models.Model):
    parking_spot = models.ForeignKey(ParkingSpot)
    rule = models.CharField(max_length=255)
    start_time = models.TimeField()
    end_time = models.TimeField()
    time_limit = models.IntegerField()
    zone_number = models.IntegerField()
    zone_limit_other = models.IntegerField()
    days_of_the_week = models.CharField(max_length=255)
    supports_holidays = models.BooleanField()
    hourly_rate = models.DecimalField(max_digits=6, decimal_places=2)
