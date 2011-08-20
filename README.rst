.. contents :: :local:

Introduction
-------------

Krusovice is a high quality HTML5 rhytmic photo show creator
which you can integrate to your website.

Background
----------

This is a rewrite and clean-up of previous slideshow9000 attempt.

Componets
------------

Timeliner
=======================

Timeliner takes in a set of show elements (images, text slides) and puts
them on a timeline based on music rhytm data.

Timeline visualization
=======================

Timeline visualization is an utility which shows your built 
timeline, so you can see where slides come in and out.

Player
=======================

Player plays the ready show plan in a <canvas>.


        
Unit tests
------------

JsTestDriver is a Javascript unit testing tool and framework from Google.
It will automatically load a set fo static JS files and execute unit test 
cases for them.

JsTestDriver provides its own unit testing suite, but it can be integrated with
other test frameworks (QUnit).

JsTestDriver limitations
==========================

Currently JsTestDriver has some limitations which I hope to have as features in the future

* You still need to Alt-Tab to the browser to check console logs 
 
JS-test-driver command line
=============================

* http://code.google.com/p/js-test-driver/wiki/GettingStarted

::
        
        wget http://js-test-driver.googlecode.com/files/JsTestDriver-1.3.2.jar
        java -jar JsTestDriver-1.3.2.jar --port 9876
        
Then visit

        http://localhost:9876
        
Leave the browser running. Put the job JsTestDriver on background.

Now trigger a test run::

        java -jar JsTestDriver-1.3.2.jar --tests all
           
Asserts with JsTestDriver
===========================

A good guide to different asserts you can make is in the source code itself

* http://code.google.com/p/js-test-driver/source/browse/trunk/JsTestDriver/src/com/google/jstestdriver/javascript/Asserts.js
                         
Eclipse plug-in
=============================

Install JsTestDrive plug-in

* `Instructions <http://code.google.com/p/js-test-driver/wiki/UsingTheEclipsePlugin>`_

* `Eclipse Update site URL <http://js-test-driver.googlecode.com/svn/update/>`_

.. warning

        Only version 1.1.1.e or later works. Don't pick
        version 1.1.1.c.
        
* http://code.google.com/p/js-test-driver/issues/detail?id=214       

*Run Configurations...* -> for JSTest. Select a .conf file from the project root.
Don't run it yet, just save.

Open JsTestDriver view: *Window* -> * Show view* -> *Other* -> *Javascript* -> *JsTestDriver*.

Click *Play* to start test runner server.
Now JsTsetDriver view shows "capture" URL - go there with your browser(s). Each browser running
a page in this URL is a slave to JsTestDriver and will run the tests. I usually keep
one browser for running tests / code and other open for normal surfing e.g. Firefox as browser browser
and Chrome for testing and debugging. The test browser can has its console all the time open,
so you can check the console messages from there.

The test machinery has been set-up now.
Now you can 

 * Run tests manually from Eclipse launcher
 
 * Toggle checkbox *Run on Save* in the run configuration to see unit tests results after each file save 

After run you see the test output in *JsTestDriver* view per browser.

.. note ::

        For some reason I could not get output/stacktrace from failed tests on Chrome
        on one of two test Macs. Safari was ok.

Breakpoints and Eclipse JsTestDriver
========================================

Instructions for Safari, but should apply to other browsers as well.

* Capture browser

* Run unit tests

* See some test is failing

* Go to captured browser, Javascript debugger

* Add breakpoint to the failing test, before the assert/line that fails

* Go to Eclipse (Alt+tab)

* Hit *Rerun last configuration* in *JsTestDriver* view

* Now your browser should stop in the breakpoint

Documentation
---------------

Building API documentation
==============================

Installing prerequisitements (OSX)::

        sudo gem install rdiscount json parallel rspec

Installing JSDuck::

        # --pre installs 2.0 beta version
        gem install --pre jsduck
                              
Building docs with JSDuck::
                
        jsduck src --verbose --output docs

More info

* https://github.com/nene/jsduck
