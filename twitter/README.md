# Copy Selected Tweet

This is a script that I created to copy Tweet content from the main web app.

It finds the Tweet that the selected text belongs to and parses it into a structure,
and then creates a string from a templated and the selected tweet structure.

It installs a copy handler the overrides ctrl+c if a selected Tweet is found.

![Screenshot](screenshot.png?raw=true "Screenshot")

## State

The script no longer works due to UI changes and updating it is low priority.

There are no test cases from when it was functional, unfortunately, but I've added a representative set of test cases to updated the code with.

There is no JS test framework or suite chosed to run test cases with, but I've tried to make that step easy to take.

In another Dev Practice session I created a bare bones "portable" browser extension that loads on twitter.com, which could in theory replace
the manual install process of this script and it's very easy to do.

The configurable parts of the JS file are fairly well documented, but the portion below the mark "works" but isn't very nice.

## Usage

Install via web developer tools. See the copy-selected-tweet.js file for details and configuration.
