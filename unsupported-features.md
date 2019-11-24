## Python Tutor's server and live chat service may go down at any time and lose your code! There is NO on-call technical support available.

This free website is maintained by one volunteer in my spare time, so I'm unable to respond to most requests. Your issue is probably listed here. If you're sure it's not here yet, [email me](http://pgbovine.net/email-policy.htm) or file a GitHub issue, and use the "Generate permanent link" button to include a URL of your code. **I prioritize reproducible bug reports that show the visualizer doing something clearly incorrect.**

- If you don't get a reply from me, assume your issue will NOT be addressed. *Please don't email me multiple times.*
- I can't personally provide any programming help. Use the "Get live help!" button to request help from volunteers.
- I can't provide technical support for users who want to install Python Tutor on their own computers/servers.
- I can't provide support for Python Tutor code embedded in other websites. Contact those site owners for help.
- I don't have time to review any outside code contributions or GitHub pull requests. Feel free to fork the code.


## Unsupported features

### Read this first!

Python Tutor is designed to imitate what an instructor in an **introductory programming class** draws on the blackboard:

![drawing on blackboard](board.jpg)

(source: UC Berkeley's CS61B course)

It's meant to illustrate **small pieces of self-contained code** that runs for not too many steps. After all, an instructor can't write hundreds of lines of code, draw hundreds of data structures and pointers, or walk through hundreds of execution steps on the board! Also, code in introductory classes usually doesn't access external libraries. If your code can't fit on a blackboard or a single presentation slide, it's probably too long to visualize effectively in Python Tutor.

Due to this ultra-focused design, the following features are not supported and will likely *never* be supported:

- Code that is too large in size.
  - [shorten your code](https://stackoverflow.com/help/minimal-reproducible-example) to what fits on a blackboard or presentation slide!
  - Python Tutor is *not* for debugging arbitrary code that you paste into it; you'll need to shorten your code to isolate what you want to debug
- Code that runs for too many steps (e.g., > 1,000 steps) or for a long time
  - [shorten your code](https://stackoverflow.com/help/minimal-reproducible-example) to isolate exactly what operations you want to visualize
  - e.g., make your numbers and strings smaller, your data structures contain fewer items, and your loops/functions run fewer times
  - or [set Python breakpoints](https://youtu.be/80ztTXP90Vs?t=42) using `#break` comments
- Visualizing custom data structures from imported libraries; Python Tutor visualizes only built-in types and data structures
- Importing most external libraries (try "Python 3.6 with Anaconda (experimental)" to access more libraries)
- Reading data from external files (you can use strings to emulate files: examples for [Python3](http://goo.gl/uNvBGl) and [Python2](http://goo.gl/Q9xQ4p))
- Interfacing with databases, filesystems, networking, or other external resources
- Anything involving GUI programming or GUI/webpage components
- Multi-threaded, concurrent, or asynchronous code; Python Tutor is only for regular single-threaded execution
- Advanced language features or subtleties that only experts need to know (this is a tool for teaching *novices*)
- Compile-time magic (e.g., macros, metaprogramming, templates) can't be visualized; Python Tutor visualizes only run-time memory state
- Editing multiple source code files (Python Tutor is not an IDE!)
- User accounts, saving code as files in the cloud, or integrating with online services like GitHub (again, Python Tutor is not an IDE!)
- Integrating with programming environments like Jupyter Notebooks, IDEs, or text editors


### Python unsupported features

- for strings and numbers, you can't rely on the behaviors of `id()` or `is` matching CPython on your computer; when teaching beginners, you shouldn't rely on these behaviors since they are implementation-specific optimizations.
  - see GitHub issues [here](https://github.com/pgbovine/OnlinePythonTutor/issues/275) and [here](https://github.com/pgbovine/OnlinePythonTutor/issues/273) and [here](https://github.com/pgbovine/OnlinePythonTutor/issues/255)
- some infinite loops: the server times out without showing partial results or good error messages
  - to cut down execution times, [set Python breakpoints](https://youtu.be/80ztTXP90Vs?t=42) using `#break` comments
- random number generators and user input (via input() or raw_input()) [sometimes don't work well together](https://github.com/pgbovine/OnlinePythonTutor/issues/110)
- raw_input/input might not work in iframe embeds
- more GitHub issues: https://github.com/pgbovine/OnlinePythonTutor/issues


### C and C++ unsupported features

- [doesn't visualize when function parameters get mutated](https://github.com/pgbovine/opt-cpp-backend/issues/57) (make a copy to a new local variable to visualize)
- [doesn't visualize function return values](https://github.com/pgbovine/opt-cpp-backend/issues/4) (add a temporary return variable to visualize)
- [unions](https://github.com/pgbovine/opt-cpp-backend/issues/68)
- taking text input from the user using scanf(), fgets with stdin, cin >>,  etc.
- code with [undefined behavior](https://blog.regehr.org/archives/213) may not match what happens when running on your own computer!
  - specifically, code with memory errors will fail-fast using [Valgrind Memcheck](http://valgrind.org/docs/manual/mc-manual.html)
- some complex typedefs
- [stack arrays without compile-time sizes](https://github.com/pgbovine/opt-cpp-backend/issues/44)
- [read-only memory isn't visualized separately from the heap](https://github.com/pgbovine/opt-cpp-backend/issues/70)
- [struct members declared as unbounded arrays](https://github.com/pgbovine/opt-cpp-backend/issues/73)
- [mixed pointer/array declared types](https://github.com/pgbovine/opt-cpp-backend/issues/74)
- [static array initializers](https://github.com/pgbovine/opt-cpp-backend/issues/75)
- C++ STL containers and strings aren't visualized nicely (see [GitHub issue](https://github.com/pgbovine/OnlinePythonTutor/issues/256))
- haven't tested on various C++ smart pointers yet
- haven't tested on inline functions (e.g., explicitly 'inline' or implicitly inlined member functions defined within class definitions, etc)
- probably lots of untested subtleties with more advanced modern C++ features from C++11 and newer

Look at these GitHub issues for more C/C++ unsupported features: https://github.com/pgbovine/opt-cpp-backend/issues


### JavaScript unsupported features

- asynchronous and event-driven code
  - including setTimeout, setInterval, etc.
  - promises, async/await
- anything that operates on webpages, such as DOM manipulation, alert(), prompt(), confirm(), etc.
  - this includes trying to import frontend libraries or frameworks (e.g., jQuery, React)
- Date() object
- some let-defined variables don't display properly ([example](https://github.com/pgbovine/OnlinePythonTutor/issues/285)) (this is something I want to eventually fix ... email me or file a GitHub issue if you find more examples!)
- more JavaScript unsupported features: https://github.com/pgbovine/OnlinePythonTutor/issues?q=is%3Aissue+is%3Aopen+label%3Ajavascript

### Java unsupported features

- some data structures like ArrayList aren't visualized properly (see [GitHub issue](https://github.com/pgbovine/OnlinePythonTutor/issues/236))

### Ruby unsupported features

- see GitHub issues: https://github.com/pgbovine/OnlinePythonTutor/issues?q=is%3Aissue+is%3Aopen+label%3Aruby


### Other language-independent unsupported features

- Python Tutor is meant for desktop/laptop computers, **not for mobile devices**. Some features such as live help mode simply don't work on mobile devices. The UI also looks cluttered and can be buggy on small screens.
- Stepping *within* a line of code to show how subexpressions get evaluated within that line; the best workaround is to split complex expressions into multiple lines and assign temporary variables on each line ([example](http://pythontutor.com/visualize.html#code=w%20%3D%205%0Ax%20%3D%2010%0Ay%20%3D%2020%0Az%20%3D%2030%0A%0A%23%20bad%3A%20executes%20all%20at%20once%0Aresult%20%3D%20w%20-%20x%20*%20%28y%20%2B%20z%29%0A%0A%23%20good%3A%20shows%20individual%20steps%0At1%20%3D%20y%20%2B%20z%0At2%20%3D%20x%20*%20t1%0Aresult2%20%3D%20w%20-%20t2&cumulative=false&heapPrimitives=nevernest&mode=edit&origin=opt-frontend.js&py=2&rawInputLstJSON=%5B%5D&textReferences=false)).
- Unicode doesn't well, especially for Ruby: [#134](https://github.com/pgbovine/OnlinePythonTutor/issues/134), and Python 2: [#77](https://github.com/pgbovine/OnlinePythonTutor/issues/77), [#124](https://github.com/pgbovine/OnlinePythonTutor/issues/124), [#194](https://github.com/pgbovine/OnlinePythonTutor/issues/194) (use ASCII characters when possible)
- Passing in command-line arguments via argv[] array (use hard-coded strings instead)
- If you're behind some kinds of firewalls or proxy servers, the visualizer or live chat may not work
- URL shortening (you should use your own third-party URL shortener service)
- https iframe embedding with non-Python languages (iframe embed should work for Python if you use `https://` for URL)
- Standalone application or offline mode (you can download the code and install it yourself but I don't have time to provide tech support for local installations)

Look at these issues for more unsupported features: https://github.com/pgbovine/OnlinePythonTutor/issues


## FAQ

### I thought all objects in Python are (conceptually) on the heap; why does Python Tutor render primitive values (e.g., numbers, strings) inside of stack frames?

This was a design decision made to keep the display less cluttered;
if we were truly faithful to Python's semantics, that would result in far too many arrows (pointers) being drawn.
However, note that since primitives are **immutable** and thus behave identically regardless of aliasing,
it doesn't matter whether they're rendered in the stack or heap.

Update on 2013-01-06: I've added a drop-down menu option with two choices:
"inline primitives and nested objects" versus "render all objects on the heap".
If you want to render all objects on the heap, select the latter option.
To avoid too many arrows being drawn, also toggle the default "draw references using arrows" option
to "use text labels for references". Here is a direct link to activate those two settings:

http://pythontutor.com/visualize.html#heapPrimitives=true&textReferences=true


### I don't like your default toggle options. Can I set different defaults?

Of course! Toggle options are customizable via the query string. Here are the default settings:

http://pythontutor.com/visualize.html#cumulative=false&heapPrimitives=nevernest&drawParentPointers=false&textReferences=false&showOnlyOutputs=false&py=3

For example, if you want to default to C, visit:
http://pythontutor.com/visualize.html#&py=c

Or Java:
http://pythontutor.com/visualize.html#&py=java

Or if you want to render all objects on the heap and use text label references, visit:
http://pythontutor.com/visualize.html#heapPrimitives=true&textReferences=true


### Can I iframe-embed using https?

Yes, only for Python, though. Change the embed URL from http:// to https:// and it should hopefully work.


### I have an idea for a brand-new feature ...

First check out this [wishlist doc](wishlist.md), then feel free to email me if you have ideas that haven't yet been mentioned there.
