/**
 * Helper classes to deal with sound analysis JSON data.
 * Exported by Echo Nest Remix or custom scripts.
 *
 * Note that all clocks here are in milliseconds, not seconds
 * (start, duration).
 *
 */

/*global define, window, console, jQuery, document, setTimeout */

define("krusovice/analyses", ["krusovice/thirdparty/jquery-bundle", "krusovice/core"], function($, krusovice) {
"use strict";

/**
 * A proxy object which helper functions to deal with rhytm data.
 *
 * @param data EchoNest rhytm data
 */
krusovice.RhythmAnalysis = function(data) {

    if(!data) {
        throw "Rhythm data must be given";
    }

    this.data = data;

};

krusovice.RhythmAnalysis.prototype = {

    /**
     * @type Number
     *
     * What's the max beat confidense value in the whole song
     */
    maxBeatConfidence : 0,

    /**
     * Scan through all beats and initialize boundaries.
     */
    initBeats : function() {

        // Search max confidence in beats
        var maxBeatConfidence = 0;

        this.data.beats.forEach(function(b) {
            if(b.confidence > maxBeatConfidence) {
                maxBeatConfidence = b.confidence;
            }
        });

        this.maxBeatConfidence = maxBeatConfidence;

        // How sure we must be about the beat to accept it

        if(maxBeatConfidence === 0) {
            // Echo Nest could not analyze confidence, but we still got beat list
            this.minBeatConfidence = 0;
        } else {
           // Use beats by arbitary value
           this.minBeatConfidence = 0.5;
        }

        console.log("Using default beat confidence threshold of " + this.minBeatConfidence);

    },

    /**
     * Find the next starting beat from the certain position
     *
     * @param clock Song position in seconds
     *
     * @param skip Skip rate. 1= every beat, 2 = every second beat
     *
     * @return AudioQuantum object
     */
    findNextBeat :function(clock, skip) {

        var beat = 0;

        var i = 0;

        clock *= 1000;

        var confidenceThreshold = this.minBeatConfidence;

        for(i=0; i<this.data.beats.length; i++) {
            var t = this.data.beats[i];
            if(t.confidence < confidenceThreshold) {
                continue;
            }

            if(t.start > clock) {
                beat = t;
                break;
            }

        }

        return beat;
    },

    /**
     * Find the latest beat for a clock position.
     *
     * Note: beat is not at the clock, but has happened some time ago.
     *
     * @param clock Song position in seconds
     *
     * @return beat object
     */
    findBeatAtClock : function(clock, confidenceTreshold) {

        var beat = null;

        var i = 0;

        clock *= 1000;

        var confidenceThreshold = (confidenceTreshold !== undefined) ? confidenceThreshold : this.minBeatConfidence;

        for(i=0; i<this.data.beats.length; i++) {
            var t = this.data.beats[i];

            if(t.confidence < confidenceThreshold) {
                continue;
            }

            if(t.start <= clock) {
                beat = t;
            }

            if(t.start > clock) {
                // Beats coming after clock
                break;
            }

        }

        return beat;

    },


    /**
     * Generic AudioQuantum array search
     *
     * @param {Object} array
     * @param {Object} name
     * @param {Object} clock
     * @param {Object} skip
     * @param {Object} confidence
     */
    findLast: function(array, clock, skip, confidenceThreshold) {

        var item = null;

        var i;
        for(i=0; i<array.length;i++) {

                    var t = array[i];

            if(t.confidence < confidenceThreshold) {
                continue;
            }

            if(t.start > clock) {
                break;
            }

            item = t;
        }

        return item;
    },



    /**
     * Return the next bar following a chosen moment.
     *
     * @param {Number} clock Time in seconds
     *
     * @return bar index or -1 if no hit
     */
    findBarAtClock : function(clock) {
        var i;
        var bars = this.data.bars;

        // Convert to ms
        clock *= 1000;

        for(i=0; i<bars.length; i++) {
            var b = bars[i];

            if(clock >= b.start && clock < b.start+b.duration) {
                //console.log("Bar match:" + i);
                //console.log(clock);
                //console.log(b);
                return i;
            }
        }

        return -1;
    },



    /**
     * Return the bar being played at certain moment.
     *
     * @param {Number} clock Time in seconds
     *
     * @return bar index or -1 if no hit
     */
    findNextBar : function(clock) {
        var bari = this.findBarAtClock(clock);

        // No more bars left in the song
        if(bari < 0) {
            return -1;
        }

        bari += 1;

        if(bari >= this.data.bars.length) {
            return -1;
        }
        return bari;
    }

};

/**
 * Helper class to deal with pre-calcaulated loudness sampiling.
 * @param {Object} data Loudness adat as generated by levels.py
 */
function LoudnessAnalysis(data) {
    this.data = data;
}


$.extend(LoudnessAnalysis.prototype, {

    /**
     * Get loudness level at a specific timepoint
     *
     * @param  {Number} clock Song position in seconds
     * @return {Number} Normalized, interpolated, loudness sample
     */
   getLevel : function(clock) {

       if(clock < 0) {
           return 0;
       }

       var sampleDuration = this.data.interval;

       var index = Math.floor(clock / sampleDuration);

       // Past the end
       if(index >= this.data.peaks.length) {
           return 0;
       }

       // peak, decay, RMS
       var triplet = this.data.peaks[index];

       // decay
       return triplet[0];
   }

});

/**
 * Real-time spectrum FFT for on-going audio playback.
 *
 * http://0xfe.blogspot.fi/2011/08/web-audio-spectrum-analyzer.html
 */
function RealTimeSpectrumAnalysis(config) {
    $.extend(this, config);
    this.fft = this.actx.createAnalyser();
    this.fft.fftSize = this.points; // 15 different bands
    this.fft.smoothingTimeConstant = this.smoothing;
    this.data = new Uint8Array(this.fft.frequencyBinCount);
}

$.extend(RealTimeSpectrumAnalysis.prototype, {

    data : null,

    bins : 30,

    points : 2048,

    smoothing : 0.75,

    average : 0,

    /** millisecs how often we are updates */
    rate : 50,

    /** <canvas> were we dump visual output for debugging */
    canvas : null,

    /**
     * Call regularly to update the data buffer
     */
    update : function() {

        var data = this.data;

        // Get the frequency-domain data
        this.analyzer.getByteFrequencyData(data);

        // Update also visual output
        if(this.canvas) {
            this.drawBars(this.canvas);
        }

    },

    /**
     * http://code.google.com/p/chromium/source/browse/trunk/samples/audio/MediaElementAudioSourceNode.html?r=3147
     *
     * @param  {[type]} audio [description]
     * @return {[type]}       [description]
     */
    bindToAudio : function(audio) {
    },

    start : function() {
        var self = this;
        if (!this.intervalId) {
        this.intervalId = window.setInterval(
            function() { self.update(); }, self.rate);
        }
    },

    stop : function() {

    },

    getBand : function(point, width) {
    },

    /**
     * Visualize spectrum analyser on its own <canvas> element
     */
    drawBars : function(canvas) {

        var ctx = canvas.getContext();

        // Clear the canvas
        ctx.clearRect(0, 0, this.width, this.height);

        var data = this.data;

        var length = data.length;

        if (this.valid_points > 0) length = this.valid_points;

        // Clear canvas then redraw graph.
        this.ctx.clearRect(0, 0, this.width, this.height);

        var bar_spacing = 3;

        // Break the samples up into bins
        var bin_size = Math.floor(length / this.bins);

        for (var i=0; i < this.num_bins; ++i) {
            var sum = 0;
            for (var j=0; j < bin_size; ++j) {
                sum += data[(i * bin_size) + j];
            }

            // Calculate the average frequency of the samples in the bin
            var average = sum / bin_size;

            // Draw the bars on the canvas
            var bar_width = this.width / this.num_bins;
            var scaled_average = (average / 256) * this.height;

            ctx.fillRect(i * bar_width, this.height, bar_width - bar_spacing, - scaled_average);
        }
    }
});


return {
    RhythmAnalysis : krusovice.RhythmAnalysis,
    LoudnessAnalysis : LoudnessAnalysis,
    RealTimeSpectrumAnalysis : RealTimeSpectrumAnalysis
};

});
