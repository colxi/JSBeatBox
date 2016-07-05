/*
	Project Name: JSmusicalClock
	Version: 1.0 (01/07/2013)
	Author: colxi
	Author URI: http://www.colxi.info/
	Description: This musical clock offer an accurate precision time measuring and time-events triggering. 
	 
	It can deal with a of Hemidemisemiquaver (Sixty-fourth) beat subdivision resolution, under the 160 bps.
	That translates into 16 ticks per beat in a binary time signature (6/8, 9/8, 12/8), 
	and 24 ticks per beat in a ternary time signature (2/4, 3/4, 4/4).
 
	It has a tick-event scheduler, so when a tick-event array definition and a callback 
	function are provided, triggers callback function in corresponding tick request.  
	---
	Accepts 'smart' tick-events scheduling to custom callback function, by using provided array tick-event declaration
	in two diferent ways:

	shows how to use a collaboration between a setTimeout scheduler and the Web Audio scheduler to properly implement rock-solid timing for audio applications.
	based in https://github.com/cwilso/metronome
		
*/

/*
    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.
*/

// requestAnimFrame , prefix normalization
window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame||
	window.webkitRequestAnimationFrame 	||
	window.mozRequestAnimationFrame 	||
	window.oRequestAnimationFrame 		||
	window.msRequestAnimationFrame 		||
	function(callback){window.setTimeout(callback, 1000 / 60) };
})();

window.cancelRequestAnimFrame = ( function() {
    return window.cancelAnimationFrame     		||
        window.webkitCancelRequestAnimationFrame||
        window.mozCancelRequestAnimationFrame	||
        window.oCancelRequestAnimationFrame		||
        window.msCancelRequestAnimationFrame	||
        clearTimeout;
} )();

// AudioContext , prefix normalization
window.AudioContext = ( function() {
	return 	window.AudioContext  ||
			webkitAudioContext;
} )();


// Musical Clock Object

var musicalClock = (function(){		
	// ---***  Internal Properties and Methods 
	
	// engine variables
	var isPlaying 				= false;	// isPlaying Flag.
	var startTime				= null		// store play start AudioContext time value.
	var timerHandler 			= null;		// will store here setInterval pointer.
	var animFrameHandler 		= null;		// will store here animFrame pointer.
	var _lookahead 				= 25.0;    	// frequency of scheduling function execution (ms).
	var _scheduleAheadTime 		= 0.1;		// time distance ahead to schedule audio (sec).
	var scheduledTicks		 	= [];		// user provided list of ticks that sould launch a callback function.
	var scheduledTicksExecuted 	= []; 		// Scheduled ticks that already happened. (Used in async callbacks).
	var minTempo				= 10;		// minimum allowed bps value
	var maxTempo				= 200;		// maximum allowed bps value
	
	function calculateBeatResolution(){ 
		if(beatResolutionLevel == 0) return 1;
		return Math.pow(2, beatResolutionLevel-1) * beatSubdivisionType;
	}
	
	function calculateTickLength(){ return 60.0 / tempo / beatResolution; };

	// tempo & other default values
	var tempo 					= 60.0;		// timer tempo (bps)
	var timeSignature			= '4/4';	// string format of time signatur
	var beatsPerBar				= 4;		// first value of timeSignature
	var effectiveBeatsPerBar	= 4;		// first value of timeSignature
	var beatSubdivisionType		= 2;		// calculated from timeSignature (2 (binary) | 3 (ternary)
	var beatResolutionLevel		= 4;
	
	// tick variables
	var beatResolution			= calculateBeatResolution();
	var tickLength 				= calculateTickLength();
	
	// counters def and initialization
	var currentTick 			= null;
	var currentBeat				= null;
	var currentSubBeat		 	= null;     	// tick number (beat subdivision tick)
	var currentBar				= null;
	var nextScheduledTick 		= null;
	var scheduleListPosition 	= null;
	var nextTickStartTime 		= null;    	// time where the next tick is launched.
	var lastAsyncTick			= null;
	
	function initializeCounters(){
			currentTick 			= 1;
			currentBeat				= 1;
			currentSubBeat		 	= 1;  
			currentBar				= 1;
			nextScheduledTick 		= 0;
			scheduleListPosition 	= 0;
			nextTickStartTime 		= 0.0;
			lastAsyncTick			= -1;
	};

	function tickCounterIncrease(){
		// increase by 1, currentTick , currentSubBeat counters
		currentTick++;
		currentSubBeat++;
		
		// update musical counters  (currentBeat, currentBar)
		if (currentSubBeat > beatResolution){ 					// if end of beat reached...
			currentSubBeat = 1;
			currentBeat++;
			if(currentBeat > effectiveBeatsPerBar){		// if complete bar beats reached...
				currentBeat = 1;
				currentBar++;
			}
		}
		return true;
	}
	
	function syncCallbacksManager(){
		// if SYNC callback for each tick was setted, execute it
		if(public.onTick.sync) public.onTick.sync(nextTickStartTime);
		
		// if current tick is scheduled...
		if(currentTick == nextScheduledTick){
			// push the event on the queue (used to manage lost ticks in async mode)
			scheduledTicksExecuted.push({ tick: currentTick, time: nextTickStartTime });
			
			// if there is SYNC callback for CURRENT tick, execute it
			if(public.onScheduledTick.sync) public.onScheduledTick.sync(nextTickStartTime);
			
			// assign nextScheduledTick
			nextScheduledTick = (++scheduleListPosition != scheduledTicks.length) ? scheduledTicks[scheduleListPosition] : -1;
			
			// if there are no more scheduled ticks...				
			if(nextScheduledTick == -1){
				if(public.onScheduleEnd) public.onScheduleEnd(); 			// launch Callback
				if(public.stopOnScheduleEnd) return public.stop();			// stop clock if setted
			}
		}
	}
	
	function syncTickManager(){
		// don't enter tick if clock is stopped
		if(!isPlaying) return;
		
		// schedule all events that will need to play before the next interval, 
		while(nextTickStartTime < public.audioContext.currentTime + _scheduleAheadTime){
			
			// increase tick & counters...
			tickCounterIncrease()
			
			// execute callbakcs if necessary
			syncCallbacksManager()
			
			// calculate nextTick Start Time
			nextTickStartTime += tickLength; 
		}
		
		// done! prepare for next call
		timerHandler = setTimeout(syncTickManager, _lookahead);
	};
	
	
	function asyncTickManager() {
		var _currentTick = lastAsyncTick;
		var currentTime = public.audioContext.currentTime;
		
		// remove all lost tick, and keep following events after currentTime;
		while (scheduledTicksExecuted.length && scheduledTicksExecuted[0].time < currentTime) {
			_currentTick = scheduledTicksExecuted[0].tick;
			scheduledTicksExecuted.splice(0,1);   // remove lost ticks from queue
		}
		
		if(public.onTick.async) public.onTick.async();

		if (lastAsyncTick != _currentTick) {
			if(public.onScheduledTick.async) public.onScheduledTick.async();
			lastAsyncTick = _currentTick;
		}

		// done!
		animFrameHandler = requestAnimFrame(asyncTickManager);
	}
	
	
	/*
	/
	/ PUBLIC API METHODS!
	/
	/ following methods constitute the public API methods
	/ accesible for application behaviour manipulatition and interaction.
	/
	*/
	
	var public = {
		audioContext : null,	// audioContext handler (can be internal or external)

		play : function() {
			// start play
			if(isPlaying) return false;

			// determine if audioContext creation is needed
			if(this.audioContext == undefined) this.audioContext = new AudioContext(); 
			else if(this.audioContext.constructor != AudioContext) this.audioContext = new AudioContext(); 

			// initialize variables
			if(scheduledTicks.length !=0) nextScheduledTick = scheduledTicks[0];
			startTime = this.audioContext.currentTime; 
			nextTickStartTime = startTime;
			
			//***  PATCH to force audiocontext Timer start!
			var initMutedSound = musicalClock.audioContext.createOscillator();
			delete initMutedSound;
			
			// launch first tick callbakcs (if they where setted)
			syncCallbacksManager()
			// if async listeners have been setted, initialize loopback
			if(this.onTick.async || this.onScheduledTick.async) animFrameHandler = requestAnimFrame(asyncTickManager);

			// schedule second tick ticking
			nextTickStartTime += tickLength;
			timerHandler = setTimeout(syncTickManager, tickLength + _lookahead);
			
			isPlaying = true;
			return true;
		},
		
		stop : function(){
			// stop replay request
			
			if(!isPlaying) return true;
			isPlaying = false;
			
			// remove timeouts
			cancelRequestAnimFrame(animFrameHandler);
			clearTimeout(timerHandler);
			
			// set counters to original value
			scheduledTicksExecuted	= [];
			
			initializeCounters();
			return true;
		},
		
		setTempo : function(newTempo){
			// set new tempo
			if(newTempo == NaN) throw new Error('Invalid tempo provided(' + newTempo + ')');
			if(newTempo < minTempo) newTempo = minTempo ;
			if(newTempo > maxTempo) newTempo = maxTempo;
			
			// assign new tempo
			tempo = newTempo;
			// calculate tickLength for new tempo
			tickLength	= calculateTickLength();

			return true;
		},
		
		getTempo: function(){ return tempo; },
		
		
		setBeatResolutionLevel : function(newBeatResolutionLevel){
			// asign new tick resolution to each beat (ticks per beat subdivision)
			
			var _oldBeatResolution = beatResolution;
			
			beatResolutionLevel = newBeatResolutionLevel;
			beatResolution = calculateBeatResolution();
			tickLength	= calculateTickLength();
			// adjust sheduled Ticks to new resolution to preserve relative positions
			scheduledTicks = this.expandContractTickArray(scheduledTicks, beatResolution /_oldBeatResolution);
			
			return beatResolution;
		},
		
		getBeatResolutionLevel : function(){ return beatResolutionLevel; },
		
		getBeatResolution : function(){ return beatResolution; },
		
		
		setTimeSignature : function(ts){
			// set new time signature
			
			// input value validaion
			var tsParts = ts.split("/");
			if(tsParts.length !=2) throw new Error('Invalid time Signature (' + ts + ')');
			if(tsParts[0] == NaN) throw new Error('Invalid time Signature value (' + tsParts[0] + ' NaN)');
			if(tsParts[1] == NaN) throw new Error('Invalid time Signature value (' + tsParts[1] + ' NaN)');
			if(tsParts[1] != 4 && tsParts[1] != 8) throw new Error('Unsupported Time Signature (' + ts + ')');
			
			timeSignature = ts;
			
			// set specs musical for requested time signature
			beatsPerBar				= tsParts[0];		
			if(tsParts[1] == 4)	beatSubdivisionType	= 2;
			if(tsParts[1] == 8)	beatSubdivisionType	= 3;
			effectiveBeatsPerBar	= (beatSubdivisionType == 2) ? beatsPerBar : beatsPerBar / 3 ;
			beatResolution			= calculateBeatResolution();
			tickLength				= calculateTickLength();
	
			return true;
		},
		
		getTimeSignature: function(){ return timeSignature; },
		
		getBeatsPerBar: function(){ return effectiveBeatsPerBar; },
				
		
		setCurrentTick : function(tick){
			if(tick < 0) return false;
			if(tick == NaN) return false;
			if(tick != parseInt(tick)) return false;
			
			currentTick = tick; 
			
			// if there scheduledTicks, prepare scheduledTicks pointers to new position
			for(var i=0; i < scheduledTicks.length; i++){
				if(scheduledTicks[i] >= tick){
					nextScheduledTick = ( i == 0 ) ? scheduledTicks[i] :  scheduledTicks[i-1] ;
					scheduleListPosition = i;
					break;
				}
			} 
		},
		
		getCurrentTick : function(){ return currentTick; },

		getCurrentSubBeat : function(){ return currentSubBeat; },
		
		getCurrentBeat : function(){ return currentBeat; },
		
		getCurrentBar : function(){ return currentBar; },
		
		getCurrentTime : function(){ return this.audioContext.currentTime - startTime;},
		
		getNextTickStartTime : function(){ return nextTickStartTime; },
		
		
		// tick event scheduling
		
		scheduleTicks: function(ticksArray){
			// remove duplicate keys
			var temp = {};
			for (var i = 0; i < ticksArray.length; i++) temp[ticksArray[i]] = true;
			var uniq = [];
			for (var k in temp){
				// validate is a number
				var n = ~~Number(k);
				if(String(n) === k && n >= 0) uniq.push(parseInt(k));
			}
			// sort ascending
			uniq.sort(function(a,b){return a-b});
			if(ticksArray.length != uniq.length) console.log('Warning (scheduleTicks): '+ (ticksArray.length - uniq.length) + ' keys of provided array are invalid and have been removed')
			scheduledTicks = uniq;

			return true;
		},

		getScheduleTicks: function(){ return scheduledTicks; },
		
		onScheduleEnd : null,
		
		stopOnScheduleEnd : false,
		
		onTick:{
			sync: null,
			async: null,
		},
		
		onScheduledTick:{
			sync: null,
			async: null,
		},
		
		/*
		/ GENERIC METHODS
		*/
		
		expandContractTickArray: function(tickArray, factor){
			var newTick = null;
			// expand/contract tickArray list ticks with provided factor
			for (var i = 0; i < tickArray.length; i++) {
				newTick  = ( (tickArray[i] - 1) * (factor) ) + 1;
				// if is INTEGER , is a valid tick position
				if(newTick == parseInt(newTick)){
					// is INT! assign new tick position
					tickArray[i] =  newTick;
				} else{
					// new tick doesn't fit to current BeatResolution
					// remove item and decrease array iterator counter
					tickArray.splice(i,1)
					i--;
				}
			}
			return tickArray;
		}
		
		
	}
	
	// done! initialize and expose API methods
	initializeCounters();
	return public;
})()