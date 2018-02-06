# rollit

> rollup any js library or vue component

⚠️ rollit is still under development. It works perfectly with javascript and
most vue libs but may not be enough for more complicated libs. Of course, feel
free to open issues to request features and to report bugs 😄

## Installation

```sh
npm i -g rollit
```

## Usage

```sh
rollit [file]
```

To see a complete list of options, do `rollit -h`

rollit works with no option by applying default values and try to be smart to
make it as simple as running a command so most people doesn't even have to care
about options. To make this possible rollit uses
[rollup](https://rollupjs.org/) and many other plugins.

## Configuration

## Roadmap

- [ ] Local config (using cosmiconfig)
- [ ] Fix package.json to match compiled files
    - [ ] main, browser, module, unpkg
    - [ ] files property (when publish)
    - [ ] Add prepublishOnly hook
- [ ] More defaults to handle entrypoints
- [ ] entry guess by using simple globs?
- [ ] Speeds improvements
    - [ ] Dynamically add/remove plugins based on files

