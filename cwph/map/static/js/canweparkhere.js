$(document).ready(function() {
    map = null;
    parking_lines = new Array();
    parking_markers = new Array();
    
    infoWindow = new google.maps.InfoWindow();
    
    function getParameterByName(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
            results = regex.exec(location.search);
        return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
    }
    
    function initialize() {
        var mapOptions = {
            center: new google.maps.LatLng(38.929668, -77.027743),
            zoom: 13,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };

        map = new google.maps.Map(document.getElementById("map-canvas"),
        mapOptions);
        
        map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(document.getElementById('legend'));
        $('[data-toggle="tooltip"]').tooltip({'placement': 'top'});       
        
        google.maps.event.addListener(map, 'zoom_changed', function() {            
            // Show markers only at specific zoom levels
            if(map.getZoom() >= 18) {
                for(var i=0; i < parking_markers.length; i++) {
                    parking_markers[i].setVisible(true);
                }
            }
            else { // Hide them
                for(var i=0; i < parking_markers.length; i++) {
                    parking_markers[i].setVisible(false);
                }
            }
        });
        
        // Check if parameters were provided as URL parameters, if so, use these.
        if(getParameterByName('neighborhood') != '') {            
            $('#select-neighborhood').val(getParameterByName('neighborhood'));
            $('#select-choice-day').val(getParameterByName('day'));
            $('#select-choice-starttime').val(getParameterByName('start_time'));
            $('#select-choice-endtime').val(getParameterByName('end_time'));
            $('#select-zone').val(getParameterByName('zone'));
            runDataFilter();
            return;
        }

        google.maps.event.addListenerOnce(map, 'idle', function() {
            // Get current Date and fill in this information by default.
            var date = new Date();
            $('#select-choice-day').val(date.getDay());
            // Very hacky way of using string manipulation to calculate start and end time (1 hour apart)
            var hours = String(date.getHours());
            if(hours.length == 1) {
                hours = "0" + hours;
            }
            var minutes = 0;
            if(date.getMinutes() < 30) {
                minutes = "00";
            }
            else {
                minutes = "30";
            }
            var start_time = hours + ":" + minutes;
            var end_hours = String(date.getHours() + 1);
            if(end_hours.length == 1) {
                end_hours = "0" + end_hours;
            }
            if (end_hours == "24") { end_hours = "00" } // 24 == midnight.
            var end_time = end_hours + ":" + minutes;
            $('#select-choice-starttime').val(start_time);
            $('#select-choice-endtime').val(end_time);
        });

    }
    
    function getDayAsString(day) {
        if(day == 0) { return "Sun"; }
        else if(day == 1) { return "Mon"; }
        else if(day == 2) { return "Tues"; }
        else if(day == 3) { return "Wed"; }
        else if(day == 4) { return "Thurs"; }
        else if(day == 5) { return "Fri"; }
        else if(day == 6) { return "Sat"; }
        else { return ""; }
    }
    
    function canParkHere(rule, day, myStartTime, myEndTime, zone) {
		// Get Date/Time values
		var today = new Date();
        var todays_date = today.getDate();
        var todays_month = today.getMonth()+1; //January is 0!
                
        var split = myStartTime.split(":");
        var my_start_hour = new Number(split[0]);
        var my_start_minute = new Number(split[1]);
        var my_start_time = (my_start_hour * 100) + (my_start_minute * 1);

        split = myEndTime.split(":");
        var my_end_hour = new Number(split[0]);
        var my_end_minute = new Number(split[1]);
        var my_end_time = (my_end_hour * 100) + (my_end_minute * 1);
        
		split = rule.start_time.split(":");
		var hour = new Number(split[0]);
		var minute = new Number(split[1]);
		var rule_start_time = (hour * 100) + (minute * 1);
		
		split = rule.end_time.split(":");
		hour = new Number(split[0]);
		minute = new Number(split[1]);
		var rule_end_time = (hour * 100) + (minute * 1);
		
		if(rule_end_time == 0) 
		{
		    rule_end_time = 2400;
		}
		
		// Parse based on rule-type
		/*
		 * No Parking
		 * If the current time falls within the no-parking time window
		 * on the specific day(s), then return false;
		 */
		if(rule.rule == "no-parking") {
			if(rule.days_of_the_week.indexOf(getDayAsString(day)) != -1) { // Day falls within constraint
				// Time falls within window
                // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
                // (StartA <= EndB) and (EndA >= StartB)
				if(rule_start_time <= my_end_time && rule_end_time >= my_start_time) {
                    return false;
				}
			}
		}
		/*
		 * Zone Parking
		 * This should be okay at all times. But alert user of the 2 hour window
		 */
		else if(rule.rule == "zone-parking") {
			if(rule.days_of_the_week.indexOf(getDayAsString(day)) != -1) { // Day falls within constraint
				// Time falls within window
                // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
                // (StartA <= EndB) and (EndA >= StartB)
                if(zone != rule.zone_number) {
                    if(rule_start_time <= my_end_time && rule_end_time >= my_start_time) {
                        if(rule.zone_limit_other == 0.0) {
                            return false;
                        }
                        else {
                            // Assure total time is less than or equal to zone_limit_other
                            var start = my_start_hour + (my_start_minute / 60);
                            var end = my_end_hour + (my_end_minute / 60);
                            if( (end - start) > rule.zone_limit_other) {
                                return false;
                            }
                        }
                    }
                }
			}
		}
		/*
		 * Street Sweeping No Parking
		 * If the current time falls within the no-parking time window AND it is within the Street Sweeping dates
		 * on the specific day(s), then return false;
		 */
		else if(rule.rule == "streetsweeping-no-parking") {
			if(rule.days_of_the_week.indexOf(getDayAsString(day)) != -1) { // Day falls within constraint
                if(todays_month >= 3 && todays_month <= 10) {
				    // Time falls within window
                    // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
                    // (StartA <= EndB) and (EndA >= StartB)
				    if(rule_start_time <= my_end_time && rule_end_time >= my_start_time) {
                        return false;
				    }
				}
			}
		}
		/*
		 * Street Sweeping Zone Parking
		 * If the current time falls within the Street sweeping dates, this rule applys
		 * This rule will function as an exception and return TRUE if all conditions are okay.
		 */
		else if(rule.rule == "streetsweeping-zone-parking") {
			if(rule.days_of_the_week.indexOf(getDayAsString(day)) != -1) { // Day falls within constraint
			    if(todays_month >= 3 && todays_month <= 10) {
				    // Time falls within window
                    // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
                    // (StartA <= EndB) and (EndA >= StartB)
                    if(zone != rule.zone_number) {
                        if(rule_start_time <= my_end_time && rule_end_time >= my_start_time) {
                            if(rule.zone_limit_other == 0.0) {
                                return false;
                            }
                            else {
                                // Assure total time is less than or equal to zone_limit_other
                                var start = my_start_hour + (my_start_minute / 60);
                                var end = my_end_hour + (my_end_minute / 60);
                                if( (end - start) > rule.zone_limit_other) {
                                    return false;
                                }
                            }
                        }
                    }
                }
			}
		}
		/*
		 * Time Limited Parking
		 */
		else if(rule.rule == "time-limited-parking") {
			if(rule.days_of_the_week.indexOf(getDayAsString(day)) != -1) { // Day falls within constraint
				// Time falls within window
                // http://stackoverflow.com/questions/325933/determine-whether-two-date-ranges-overlap
                // (StartA <= EndB) and (EndA >= StartB)
                if(rule_start_time <= my_end_time && rule_end_time >= my_start_time) {
                    // Assure total time is less than or equal to time_limit
                    // time_limit is an integer, so we normalize to minutes
                    var start = (my_start_hour * 60) + my_start_minute;
                    var end = (my_end_hour * 60) + my_end_minute;
                    if( (end - start) > rule.time_limit) {
                        return false;
                    }
                }
			}
		}
		
		return true;
	}
	
    function formatAMPM(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        minutes = minutes < 10 ? '0'+minutes : minutes;
        var strTime = hours + ':' + minutes + ' ' + ampm;
        return strTime;
    }

    function formatDaysToString(rule) {
        var days_of_the_week = "";
        if(rule.days_of_the_week.indexOf("Sun") > -1) days_of_the_week += "Su,";
        if(rule.days_of_the_week.indexOf("Mon") > -1) days_of_the_week += "M,";
        if(rule.days_of_the_week.indexOf("Tues") > -1) days_of_the_week += "Tu,";
        if(rule.days_of_the_week.indexOf("Wed") > -1) days_of_the_week += "W,";
        if(rule.days_of_the_week.indexOf("Thurs") > -1) days_of_the_week += "Th,";
        if(rule.days_of_the_week.indexOf("Fri") > -1) days_of_the_week += "F,";
        if(rule.days_of_the_week.indexOf("Sat") > -1) days_of_the_week += "Sa,";
        if(days_of_the_week.length > 0)
            return days_of_the_week.substring(0, days_of_the_week.length -1);
        else
            return days_of_the_week;
    }
	
	function formatTime(time) {
	    var date = new Date("2010-06-09T" + time + "-04:00"); // all times are in eastern standard time (currently)
	    return formatAMPM(date);
	}
	
	/**
	* Function to format and display parking rules in the InfoWindow
	*
	* InfoWindow should look like the following:
	* 
	* -------------------------------------------
	* |      ____________________________       |
	* |      |        No Parking        |       |
	* |      |      7:00am - 8:30pm     |       |
	* |      | Su, M, Tu, W, Th, F, Sa  |       |
	* |      |__________________________|       |
	* |                                         |
	* |        *etc for additional rules        |
	* |                                         |
	* |                                         |
	* |                                         |
	* |                                         |
	* |                                         |
	* |                                         |
	* |                                         |
	* |                                         |
	* -------------------------------------------
	*/
	function rulesToInfoWindow(rules) {
	    var content = "<div class='parkingspot-infowindow'>";
	    for(var i = 0; i < rules.length; i++) {
	        rule = rules[i];
	        if(rule.rule == "no-parking") {
	            content += "<div class='parkingrule-infowindow parkingrule-red'>";
	            content += "<h2>NO PARKING</h2>";
	            var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
	            content += time;
	            content += "</br>";
                content += formatDaysToString(rule);
	            content += "</br>";
	            content += "</div>";
	        }
	        else if(rule.rule == "zone-parking") {
	            content += "<div class='parkingrule-infowindow parkingrule-purple'>";
	            content += "<h2>ZONE " + rule.zone_number + " PARKING</h2>";
	            var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
	            content += time;
	            content += "</br>";
	            content += formatDaysToString(rule);
	            content += "</br>";
	            if(rule.zone_limit_other > 0.0) {
	                content += rule.zone_limit_other + " HOUR TIME LIMIT OTHERWISE</br>";
	            }
	            content += "</div>";
	        }
	        else if(rule.rule == "streetsweeping-no-parking") {
	            content += "<div class='parkingrule-infowindow parkingrule-red'>";
	            content += "<h2>NO PARKING</h2>";
	            var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
	            content += time;
	            content += "</br>";
                content += formatDaysToString(rule);
	            content += "</br></br>";
	            content += "MARCH 1 - OCTOBER 31; Except Holidays";
	            content += "<h2>STREET</br>SWEEPING</h2>";
	            content += "</div>";
	        }
	        else if(rule.rule == "streetsweeping-zone-parking") {
	            content += "<div class='parkingrule-infowindow parkingrule-purple'>";
	            content += "<h2>ZONE " + rule.zone_number + " PARKING</h2>";
	            content += "<h2>for STREET</br>SWEEPING DAYS</h2>";
	            var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
	            content += time;
	            content += "</br>";
	            content += formatDaysToString(rule);
	            content += "</br>";
	            if(rule.zone_limit_other > 0.0) {
	                content += rule.zone_limit_other + " HOUR TIME LIMIT OTHERWISE</br>";
	            }
	            content += "</div>";
	        }
	        else if(rule.rule == "metered-parking") {
	            content += "<div class='parkingrule-infowindow parkingrule-yellow'>";
	            content += "<h2>METERED PARKING</h2>";
	            var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
	            content += time;
	            content += "</br>";
	            content += formatDaysToString(rule);
	            content += "</br>";
	            content += "RATE: " + rule.hourly_rate + " / HOUR</br>";
	            if(rule.time_limit > 0.0) {
	                content += rule.time_limit + " MINUTE TIME LIMIT</br>";
	            }
	            content += "</div>";
	        }
            else if(rule.rule == "time-limited-parking") {
                content += "<div class='parkingrule-infowindow parkingrule-green'>";
                content += "<h2>TIME LIMITED PARKING</h2>";
                var time = formatTime(rule.start_time) + " - " + formatTime(rule.end_time);
                content += time;
                content += "</br>";
                content += formatDaysToString(rule);
                content += "</br>";
                content += rule.time_limit + " MINUTE LIMIT</br>";
                content += "</div>";
            }
        }
	    content += "</div>";
	    return content;
	}
    
    /**
    * Function to reload the map with parking data from the DB
    * 
    * Parameters:
    * neighborhood - neighborhood to filter in (currently not used
    *                other than for panning to the neighborhood)
    * day - the day of the week
    * start_time - start parking time
    * end_time - end parking time
    * zone - Parking Zone (if applicable; none otherwise)
    */
    function reloadParkingData(neighborhood, day, start_time, end_time, zone) {
        // Remove from map and delete objects
        for (var i = 0; i < parking_lines.length; i++) {
            parking_lines[i].setMap(null);
            parking_lines[i] = null;
        }
        for (var i = 0; i < parking_markers.length; i++) {
            google.maps.event.clearListeners(parking_markers[i], 'click');
            parking_markers[i].setMap(null);
            parking_markers[i] = null;
        }
        parking_lines.length = 0;
        parking_markers.length = 0;

        $.get("ajax/parking_spots/",function(data,status){
            if(status == "success") {
                var parkingSpots = data;
                for(var i = 0; i < parkingSpots.length; i++) {
                    var path = new Array();
                    path.push(new google.maps.LatLng(parkingSpots[i].s_lat, parkingSpots[i].s_lng));
                    path.push(new google.maps.LatLng(parkingSpots[i].e_lat, parkingSpots[i].e_lng));
                    
                    // Add Marker at midpoint
                    var s_lat = new Number(parkingSpots[i].s_lat);
                    var s_lng = new Number(parkingSpots[i].s_lng);
                    var e_lat = new Number(parkingSpots[i].e_lat);
                    var e_lng = new Number(parkingSpots[i].e_lng);
                    var midpoint_lat = ((s_lat + e_lat) / 2);
    			    var midpoint_lng = ((s_lng + e_lng) / 2);
    			    
                    // Set color of spot based on start-time, end-time, zone and rules
                    // ParkingSpot line color logic
                    var lineColor = 'green';
        			violations = new Array();
        			
        			var hasMeteredParking = false;
        			for(var j = 0; j < parkingSpots[i].rules.length; j++) {
        			    var rule = parkingSpots[i].rules[j];
        			    // Override with Zoned street parking exception, if applicable
        			    if(rule.rule == "streetsweeping-zone-parking") {
        			        if(canParkHere(rule, day, start_time, end_time, zone)) {
        			            violations.length = 0;
        			            break;
        			        }
        			    }
        				else if(!canParkHere(rule, day, start_time, end_time, zone)) {
        					violations.push(rule);
        				}
        				
        				if(rule.rule == "metered-parking") {
        				    hasMeteredParking = true;
        				}
        			}
        			
                    // Red, if parking isn't possible
        			if(violations.length > 0) {
        				lineColor = 'red';
        			}
        			
        			// Override with Yellow for metered parking
        			if(hasMeteredParking) {
        			    lineColor = 'yellow';
        			}

                    var newPolyOptions = {
                        strokeColor: lineColor,
                        strokeOpacity: 1.0,
                        strokeWeight: 3,
                        path: path,
                        parking_spot: parkingSpots[i],
                        parking_spot_id: parkingSpots[i].id,
                        parking_rules: parkingSpots[i].rules
                    }
                    
                    newPoly = new google.maps.Polyline(newPolyOptions);
                    newPoly.setMap(map);
                    parking_lines.push(newPoly);

                    // If metered parking, just show that icon
                    if(hasMeteredParking) {
                        iconLoc = '/static/images/parking_meter_marker.png';
                    }
                    else if(violations.length == 0) { // Show Green Marker Icon if you can park
                        iconLoc = '/static/images/parking_marker.png';
                    }
                    else { // Red 'P' Marker, if you can't
                        iconLoc = '/static/images/no_parking_marker.png';
                    }
                    // Marker will store the parking_spot object
                    // Set Marker Icon based on time limit (in zones)
                    var marker = new google.maps.Marker({
                        map: map,
                        position: new google.maps.LatLng(midpoint_lat, midpoint_lng),
                        visible: true,
                        icon: iconLoc,
                        parking_spot: parkingSpots[i]
                    });
                    
                    google.maps.event.addListener(marker, 'click', function() {
                        infoWindow.close();
                        // NOTE: *do not* refer to the marker variable here. use 'this'. Otherwise shit
                        //       gets funky fast.
                        var content = rulesToInfoWindow(this['parking_spot'].rules);
                        infoWindow.setContent(content);
                        infoWindow.open(map, this);
                        $('.parkingspot-infowindow').trigger('create');
                    });
                    
                    parking_markers.push(marker);
                }
            }
        });

        // Set Location and Zoom for current neighborhood
        if(neighborhood = "columbia-heights") {
            map.setCenter(new google.maps.LatLng(38.929668, -77.027743));
            map.setZoom(19);
        }
    }

    function runDataFilter() {
        var neighborhood = $('#select-neighborhood').val();
        var day = $('#select-choice-day').val();
        var start_time = $('#select-choice-starttime').val();
        var end_time = $('#select-choice-endtime').val();
        var zone = $('#select-zone').val();

        reloadParkingData(neighborhood, day, start_time, end_time, zone);
    }

    $('#find-parking-btn').click(function() {
        runDataFilter();
    });
    
    google.maps.event.addDomListener(window, 'load', initialize);
});
