from django.conf.urls import patterns, include, url
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic.base import RedirectView

urlpatterns = [
    # favicon
    url(r'^favicon\.ico$', RedirectView.as_view(url='/static/images/favicon.ico'), name='fav-icon'),
    
    # Map
    url(r'^$', 'cwph.map.views.map', name='map'),
    
    # API calls
    url(r'^ajax/parking_spots/', 'cwph.map.views.get_parking_spots', name='get_parking_spots'),
    
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
