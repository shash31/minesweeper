window.addEventListener('DOMContentLoaded', () => {
    const gridElem = document.getElementById('grid')
    const diff = document.getElementById('difficulty-select');;
    const flagsleft = document.getElementById('nflags');
    
    const resetbtn = document.getElementById('reset-game-button');
    const newgamebtn = document.getElementById('new-game-button');
    const botplaybtn = document.getElementById('solve-game-button');
    const speedslider = document.getElementById('bot-speed-slider');
    resetbtn.addEventListener('click', reset);
    newgamebtn.addEventListener('click', newgame);
    botplaybtn.addEventListener('click', solve);
    speedslider.addEventListener('input', setSpeed);

    // Delay for solving (bot speed)
    let delay = 250

    const minesound = new Audio('assets/tick.mp3');
    const flagsound = new Audio('assets/flag.mp3');
    const unflagsound = new Audio('assets/unflag.mp3');
    const winsound = new Audio('assets/win.mp3');
    const losesound = new Audio('assets/lose.mp3');

    const confetti = new JSConfetti();

    // Long press on phones for flagging
    let pressTimer = null; 
    let longPressTriggered = false;
    
    let gridSize = null
    let nmines = null
    let grid = null;
    let nflags = 0;
    let mined = 0;
    let gameOver = false;
    let cells = null;
    let startCell = null;

    setDiff()
    generateGrid();

    function setDiff() {
        if (diff.value == 'easy') {
            gridSize = 10
            nmines = 15
            gridElem.style.setProperty('--grid-size', 10)
        } else if (diff.value == 'medium') {
            gridSize = 18
            nmines = 40
            gridElem.style.setProperty('--grid-size', 18)
        } else if (diff.value == 'hard') {
            gridSize = 24
            nmines = 100
            gridElem.style.setProperty('--grid-size', 24)
        }
        flagsleft.innerText = nmines;
    }

    function clearGrid() {
        grid = null;
        cells = null;
        gridElem.replaceChildren()
    }

    function generateGrid() {
        grid = Array.from({ length: gridSize }, () => [])
        cells = Array.from({ length: gridSize }, () => [])

        for (let i = 1; i < gridSize+1; i++) {
            for (let j = 1; j < gridSize+1; j++) {
                grid[i - 1].push(0);
                const cell = document.createElement('div');
                cell.classList.add('cell', 'unmined');
                cell.dataset.x = i - 1;
                cell.dataset.y = j - 1;
                cell.style.gridArea = `${i} / ${j} / ${i+1} / ${j+1}`;
                cell.removeEventListener('click', chord)
                cell.addEventListener("click", click);
                cell.addEventListener('contextmenu', rightclick);
                // Long press logic for mobile
                cell.addEventListener('pointerdown', startTouch);
                cell.addEventListener('pointerup', () => clearTimeout(pressTimer));
                cell.addEventListener('pointercancel', () => clearTimeout(pressTimer));
                cell.addEventListener('pointermove', () => clearTimeout(pressTimer));
                cells[i - 1].push(cell)
                gridElem.appendChild(cell);
            }
        }

        console.log(cells)

        // Generating mines
        for (let i = 0; i < nmines; i++) {
            let x = Math.floor(Math.random() * ((gridSize - 1) + 1))
            let y = Math.floor(Math.random() * ((gridSize - 1) + 1))
            while (grid[x][y] === 9) {
                x = Math.floor(Math.random() * ((gridSize - 1) + 1))
                y = Math.floor(Math.random() * ((gridSize - 1) + 1))            
            }
            grid[x][y] = 9
        }

        // Populating numbers
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (grid[i][j] === 9) { continue; }
                let mines = 0;
                for (const [x, y] of neighbours(i, j)) {
                    (grid[x][y] === 9) && mines++;
                }
                grid[i][j] = mines;
            }
        }

        // Starting point (No guessing required)
        let x = Math.floor(Math.random() * ((gridSize - 1) + 1))
        let y = Math.floor(Math.random() * ((gridSize - 1) + 1))
        while (grid[x][y] !== 0) {
            x = Math.floor(Math.random() * ((gridSize - 1) + 1))
            y = Math.floor(Math.random() * ((gridSize - 1) + 1))            
        }
        startCell = cells[x][y]
        startCell.innerText = 'X';
        startCell.style.color = 'green';

        console.log(grid);
    }

    function startTouch(e) {
        if (e.pointerType !== 'touch') return;
        longPressTriggered = false;
        const cell = e.currentTarget;
        pressTimer = setTimeout(() => {
            longPressTriggered = true;
            flag(cell);
        }, 400);
    }

    function* neighbours(x, y) {
        for (let i = -1; i <= 1; i++) {
            if ((0 <= (x+i)) && ((x+i) < gridSize)) {
                for (let j = -1; j <= 1; j++) {
                    if ((0 <= (y+j)) && ((y+j) < gridSize)) {
                        if ((i == 0) && (j == 0)) { continue }
                        yield [x + i, y + j];
                    }
                }
            }
        }
    }

    function reset() {
        end();

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const cell = cells[i][j];
                cell.classList.add('unmined')
                cell.classList.remove('flagged')
                cell.innerText = ''
                cell.removeEventListener('click', chord)
                cell.addEventListener("click", click);
                cell.addEventListener('contextmenu', rightclick);
            }
        }

        if (startCell) {
            startCell.innerText = 'X';
            startCell.style.color = 'green';
        }

        flagsleft.innerText = nmines;
    }

    function end() {
        const banner = gridElem.querySelector('#result');
        if (banner) {
            banner.remove();
        }
        gridElem.style.backgroundColor = '';

        mined = 0;
        nflags = 0;
        gameOver = false;
    }

    function newgame() {
        end();
        clearGrid();
        setDiff();
        generateGrid();
    }

    function click(event) {
        if (longPressTriggered) {
            e.preventDefault();
            return;
        }
        const cell = event.currentTarget;
        if (startCell && (mined == 0)) {
            startCell.innerText = '';
            startCell.style.color = '';
        }
        mine(cell)
    }

    function mine(cell, x, y, visited = new Set([])) {
        if (gameOver) { return }
        if (!cell) return;
        if (!(cell.classList.contains('unmined'))) { return }

        x = x || Number(cell.dataset.x);
        y = y || Number(cell.dataset.y);

        if (grid[x][y] === 9) {
            // clicked mine
            console.log('game over');
            const lost = document.createElement('p');
            lost.innerText = 'YOU LOST!!';
            lost.id = 'result'
            gridElem.appendChild(lost);
            gridElem.style.backgroundColor = 'red';
            gameOver = true;
            losesound.play();
            return;
        }

        if (grid[x][y] === 0) {
            // ripple DFS
            visited.add(`${x} ${y}`)
            for (const [nx, ny] of neighbours(x, y)) {
                if (visited.has(`${nx} ${ny}`)) { continue }
                mine(cells[nx][ny], nx, ny, visited);
            }
            cell.removeEventListener('click', click);
        } else {
            cell.removeEventListener('click', click);
            cell.addEventListener('click', chord);
            cell.innerText = grid[x][y];
        }

        cell.removeEventListener('contextmenu', rightclick);
        cell.classList.remove('unmined')
        mined++;
        // check win
        if (mined === ((gridSize**2) - nmines)) {
            console.log('won')
            const won = document.createElement('p');
            won.innerText = 'CONGRATS!!'
            won.id = 'result'
            gridElem.appendChild(won);
            gridElem.style.backgroundColor = 'green';
            gameOver = true;
            winsound.play();
            confetti.addConfetti();
            return;
        }

        minesound.play();
    }

    function chord(event) {
        if (gameOver) { return }

        const cell = event.currentTarget;
        const x = Number(cell.dataset.x);
        const y = Number(cell.dataset.y);
        const mines = grid[x][y]
        let flags = 0
        const tomine = []
        for (const [nx, ny] of neighbours(x, y)) {
            if (cells[nx][ny].classList.contains('flagged')) {
                flags++; 
            } else {
                tomine.push([nx, ny])
            }
        }

        if (flags === mines) {
            for (const[nx, ny] of tomine) {
                mine(cells[nx][ny], nx, ny)
            }
        }
    }

    function rightclick(event) {
        event.preventDefault();
        const cell = event.currentTarget;
        flag(cell);
    }

    function flag(cell) {
        if (cell.classList.contains('flagged')) {
            unflagsound.play();
            cell.classList.remove('flagged')
            nflags--;
            cell.addEventListener('click', click)
        } else {
            flagsound.play();
            nflags++;
            cell.classList.add('flagged')
            cell.removeEventListener('click', click);
        }
        flagsleft.innerText = nmines - nflags;
    }

    function setSpeed() {
        const speed = Number(speedslider.value);
        // Delay range: 0-500
        delay = 500 - (speed*5)
        console.log(`user entered speed: ${speed}`)
        console.log(`new delay speed: ${delay}`)
    }

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    async function solve() {
        resetbtn.removeEventListener('click', reset);
        newgamebtn.removeEventListener('click', newgame);

        const visibleGrid = Array.from({ length: gridSize }, () => [])
        const cellstack = [];

        if (mined == 0) {
            startCell.classList.add('hover');
            await sleep(500);
            startCell.innerText = '';
            startCell.style.color = '';
            startCell.classList.remove('hover');
            mine(startCell);
        }

        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                if (!(cells[i][j].classList.contains('unmined'))) {
                    visibleGrid[i].push(grid[i][j])
                    if (grid[i][j] != 0) cellstack.push(cells[i][j]);
                } else {
                    if (cells[i][j].classList.contains('flagged')) flag(cells[i][j]); // unflag
                    visibleGrid[i].push('D')
                }
            }
        }

        console.log('What the bot sees: ');
        console.log(visibleGrid);
        let stuck = false;

        while ((!stuck) && (!gameOver)) {
            stuck = true;
            let ind = 0;
            console.log('cellstack: ')
            console.log(cellstack)
            while (ind < cellstack.length) {
                const cell = cellstack[ind]
                console.log('checking cell:')
                console.log(cell)
                const x = Number(cell.dataset.x)
                const y = Number(cell.dataset.y)
                const n = visibleGrid[x][y]
                let unmined = []
                let flags = 0
                for (const [nx, ny] of neighbours(x, y)) {
                    if (visibleGrid[nx][ny] == 'D') unmined.push([nx, ny]);
                    if (visibleGrid[nx][ny] == 'F') flags++;
                }

                // Basic deduction
                const action = await baseLogic(n, unmined, flags);
                if (action == 'remove') {
                    cellstack.splice(ind, 1)
                    ind--;
                }

                ind++;
            }
            console.log('cellstack after iterating: ')
            console.log(cellstack)
            console.log('visible grid after iterating: ')
            console.log(visibleGrid)
            
            if (stuck && (!gameOver)) {
                // Pattern recognition (TODO: Implement more patterns/reduction for tiles other than 1)
                // 1 next to wall (1-1 or 1-2)
                // 1-2-1
                // 1-2-2-1
                console.log('TRYING PATTERN RECOGNITION')
                // await sleep(4000)
                for (const cell of cellstack) {
                    const n = Number(cell.innerText);
                    if (n != 1) continue
                    const x = Number(cell.dataset.x);
                    const y = Number(cell.dataset.y);
                    let unmined = []
                    let nbs = []
                    let zeros = 0
                    // Neighbours must be more than 1 and there cant be any flags as this is a 1 from the cellstack
                    for (const [nx, ny] of neighbours(x, y)) {
                        if (visibleGrid[nx][ny] == 'D') {
                            unmined.push([nx, ny])
                        }
                    }
                    if (unmined.length > 3) continue;
                    // only one of these is true
                    let xw = unmined[0][0] == unmined[1][0]
                    let yw = unmined[0][1] == unmined[1][1]
                    if (!(xw || yw)) continue;
                    if (unmined.length == 2) {
                        // Patterns:
                        // 'd' 'd' OR 'd' {1} 'd'
                        // {2/1} 1 OR {n} 1 {n}
                        //

                        if (xw) {
                            if (Math.abs(unmined[0][1] - unmined[1][1]) == 2) {
                                // 'd' {1} 'd' 
                                // {n} 1 {n} 
                                // OR
                                // 'd' 1 'd' 
                                // OR
                                // {n} 1 {n}
                                // 'd' {1} 'd'
                                const middle = (unmined[0][1] + unmined[1][1])/2
                                for (let i = -1; i <= 1; i++) {
                                    if (((middle+i) < 0) || ((middle+i) >= gridSize)) continue;
                                    if ((middle+i) == x) continue;
                                    await oneNeighbour(middle+i, y, unmined);
                                }
                                
                            } else {
                                // 'd' 'd' in any four corners
                                let dir = null;
                                if (unmined[0][1] != y) {
                                    dir = unmined[0][1] - y
                                } else {
                                    dir = unmined[1][1] - y
                                }
                                
                                await oneNeighbour(x, y+dir, unmined)
                            }
                        }
                        if (yw) {
                            if (Math.abs(unmined[0][0] - unmined[1][0]) == 2) {
                                // 'd'      'd'     'd'  
                                // {1} 1 OR  1 OR 1 {1}
                                // 'd'      'd'     'd'
                                const middle = (unmined[0][0] + unmined[1][0])/2
                                for (let j = -1; j <= 1; j++) {
                                    if (((middle+j) < 0) || ((middle+j) >= gridSize)) continue;
                                    if ((middle+j) == y) continue;
                                    await oneNeighbour(x, middle+j, unmined)
                                }
                            } else {
                                // 'd'
                                // 'd' in any four corners
                                let dir = null;
                                if (unmined[0][0] != x) {
                                    dir = unmined[0][0] - x
                                } else {
                                    dir = unmined[1][0] - x
                                }
                                
                                await oneNeighbour(x+dir, y, unmined)
                            }
                        }
                    }
                    if (unmined.length == 3) {
                        // wall in any direction 
                        console.log(`checking wall at ${x} ${y}`)
                        if (xw) {
                            if (unmined[2][0] != unmined[0][0]) continue;
                            let left = false;
                            let right = false;
                            if (0 <= (y - 1)) {
                                if (visibleGrid[x][y-1] == 2) {
                                    left = await twoOneNeighbour(x, y-1, unmined)
                                }
                            }
                            if ((y + 1) < gridSize) {
                                if (visibleGrid[x][y+1] == 2) {
                                    right = await twoOneNeighbour(x, y+1, unmined)
                                }
                            }
                            if (left && right) {
                                // 2-1-2
                                await botflag(unmined[0][0], y)
                            }
                        }
                        if (yw) {
                            if (unmined[2][1] != unmined[0][1]) continue;
                            let left = false;
                            let right = false;
                            if (0 <= (x - 1)) {
                                if (visibleGrid[x-1][y] == 2) {
                                    left = await twoOneNeighbour(x-1, y, unmined)
                                }
                            }
                            if ((x + 1) < gridSize) {
                                if (visibleGrid[x+1][y] == 2) {
                                    right = await twoOneNeighbour(x+1, y, unmined)
                                }
                            }
                            if (left && right) {
                                // 2-1-2 (vertical)
                                await botflag(x, unmined[0][1])
                            }
                        }
                    }
                    if (!stuck) {
                        console.log('PATTERN RECOGNITION WORKED AND DID SOMETHING (breaking out of loop)')
                        break;
                    }
                }
                if (stuck && (nflags == nmines)) {
                    for (let i = 0; i < gridSize; i++) {
                        for (let j = 0; j < gridSize; j++) {
                            if (visibleGrid[i][j] == 'D') {
                                await botmine(i, j);
                                if (gameOver) break;
                            }
                        }
                        if (gameOver) break;
                    }
                }
                console.log('out of pattern recognition cellstack loop')
                console.log(`stuck: ${stuck}`)
                // await sleep(4000);
                
                // Guessing
                // if (stuck) {
                //     console.log('still stuck now guessing')
                //     console.log('FINDING BEST GUESS');
                //     let best = 0
                //     let bc = null; 
                //     for (const cell of cellstack) {
                //         const x = Number(cell.dataset.x)
                //         const y = Number(cell.dataset.y)
                //         const n = visibleGrid[x][y]
                //         let unmined = []
                //         let flags = 0
                //         for (const [nx, ny] of neighbours(x, y)) {
                //             if (visibleGrid[nx][ny] == 'D') unmined.push([nx, ny]);
                //             if (visibleGrid[nx][ny] == 'F') flags++;
                //         }
                //         if (((unmined.length+flags) - n) > best) {
                //             // Best possible guess
                //             best = (unmined.length+flags) - n
                //             bc = unmined[0]
                //             break;
                //         }
                //     }
                //     console.log(`Best guess: ${bc}`)
                //     await botmine(bc[0], bc[1])
                // }
                
                // TODO: Constraint Satisfaction 

                // TODO: Better probability guessing

            }
        }
        console.log('finished game')

        async function twoOneNeighbour(x, y, avoid) {
            // Flag if only has one neighbour
            let unmined = []
            let flags = 0
            for (const[nx, ny] of neighbours(x, y)) {
                let same = false;
                for (const[ax, ay] of avoid) {
                    if ((nx == ax) && (ny == ay)) {
                        same = true;
                        break;
                    }
                }
                if (same || !((visibleGrid[nx][ny] == 'D') || (visibleGrid[nx][ny] == 'F'))) continue;
                if (visibleGrid[nx][ny] == 'F') {
                    flags++;
                } else {
                    unmined.push([nx, ny])
                }
            }
            if ((unmined.length == 1) && (flags == 0)) { 
                console.log(`pattern recognition flagged ${cells[unmined[0][0]][unmined[0][1]]}`)
                await botflag(unmined[0][0], unmined[0][1])
                return true;
            }
            if (((flags == 1) && (unmined.length == 0))) {
                // mine dirt of 1 thats away from two
                for (const[ax, ay] of avoid) {
                    if ((Math.abs(ax - x) == 2) || (Math.abs(ay - y) == 2)) {
                        console.log(`pattern recognition mined ${cells[ax][ay]}`)
                        await botmine(ax, ay);
                    }
                }
            }
            return false;
        }

        async function oneNeighbour(x, y, common) {
            const n = visibleGrid[x][y]
            let unmined = []
            let flags = 0
            for (const[nx, ny] of neighbours(x, y)) {
                let same = false
                for (const [ax, ay] of common) {
                    if ((nx == ax) && (ny == ay)) {
                        same = true;
                        break;
                    }
                }
                if (same || !((visibleGrid[nx][ny] == 'D') || (visibleGrid[nx][ny] == 'F'))) continue;
                if (visibleGrid[nx][ny] == 'F') {
                    flags++
                } else {
                    unmined.push([nx, ny])
                }
            }

            await baseLogic(n - 1, unmined, flags)
        }

        async function baseLogic(n, unmined, flags) {
            // Basic deduction
            if ((unmined.length+flags) == n) {
                for (const [nx, ny] of unmined) {
                    console.log('flagging neighbours')
                    await botflag(nx, ny)
                }
                return 'remove'
            } else if (flags == n) {
                // Mine unmined neighbours
                for (const [nx, ny] of unmined) {
                    if (!(cells[nx][ny].classList.contains('unmined'))) continue;
                    console.log('mining neighbours')
                    await botmine(nx, ny)
                    await sleep(delay)
                }
            }
            return;
        }

        async function botflag(x, y) {
            flag(cells[x][y]);
            visibleGrid[x][y] = 'F';
            stuck = false;
            await sleep(delay);
        }

        async function botmine(x, y) {
            cells[x][y].classList.add('hover')
            await sleep(delay)
            cells[x][y].classList.remove('hover')
            mine(cells[x][y], x, y)
            visibleGrid[x][y] = grid[x][y]
            if (grid[x][y] != 0) {
                cellstack.push(cells[x][y]);
            } else {
                updateVisibleGridDFS(`${x} ${y}`)
            }
            stuck = false;
        }

        function updateVisibleGridDFS(coords, visited = new Set([])) {
            visited.add(coords);
            const split = coords.split(" ")
            const x = Number(split[0])
            const y = Number(split[1])
            for (const [nx, ny] of neighbours(x, y)) {
                if (visited.has(`${nx} ${ny}`)) continue
                if (visibleGrid[nx][ny] != 'D') continue
                if (cells[nx][ny].classList.contains('unmined')) continue
                visibleGrid[nx][ny] = grid[nx][ny]
                if (grid[nx][ny] != 0) cellstack.push(cells[nx][ny])
                updateVisibleGridDFS(`${nx} ${ny}`, visited)
            }
        }

        resetbtn.addEventListener('click', reset);
        newgamebtn.addEventListener('click', newgame);
    }
});

var JSConfetti=function(){"use strict";function t(t,i){if(!(t instanceof i))throw new TypeError("Cannot call a class as a function")}function i(t,i){for(var e=0;e<i.length;e++){var o=i[e];o.enumerable=o.enumerable||!1,o.configurable=!0,"value"in o&&(o.writable=!0),Object.defineProperty(t,o.key,o)}}function e(t,e,o){return e&&i(t.prototype,e),o&&i(t,o),t}function o(t){return+t.replace(/px/,"")}function n(t,i){var e=arguments.length>2&&void 0!==arguments[2]?arguments[2]:0,o=Math.random()*(i-t)+t;return Math.floor(o*Math.pow(10,e))/Math.pow(10,e)}function s(t){return t[n(0,t.length)]}var a=["#fcf403","#62fc03","#f4fc03","#03e7fc","#03fca5","#a503fc","#fc03ad","#fc03c2"];function r(t){return Math.log(t)/Math.log(1920)}var h=function(){function i(e){t(this,i);var o=e.initialPosition,a=e.direction,h=e.confettiRadius,c=e.confettiColors,d=e.emojis,l=e.emojiSize,u=e.canvasWidth,f=n(.9,1.7,3)*r(u);this.confettiSpeed={x:f,y:f},this.finalConfettiSpeedX=n(.2,.6,3),this.rotationSpeed=d.length?.01:n(.03,.07,3)*r(u),this.dragForceCoefficient=n(5e-4,9e-4,6),this.radius={x:h,y:h},this.initialRadius=h,this.rotationAngle="left"===a?n(0,.2,3):n(-.2,0,3),this.emojiSize=l,this.emojiRotationAngle=n(0,2*Math.PI),this.radiusYUpdateDirection="down";var p="left"===a?n(82,15)*Math.PI/180:n(-15,-82)*Math.PI/180;this.absCos=Math.abs(Math.cos(p)),this.absSin=Math.abs(Math.sin(p));var m=n(-150,0),v={x:o.x+("left"===a?-m:m)*this.absCos,y:o.y-m*this.absSin};this.currentPosition=Object.assign({},v),this.initialPosition=Object.assign({},v),this.color=d.length?null:s(c),this.emoji=d.length?s(d):null,this.createdAt=(new Date).getTime(),this.direction=a}return e(i,[{key:"draw",value:function(t){var i=this.currentPosition,e=this.radius,o=this.color,n=this.emoji,s=this.rotationAngle,a=this.emojiRotationAngle,r=this.emojiSize,h=window.devicePixelRatio;o?(t.fillStyle=o,t.beginPath(),t.ellipse(i.x*h,i.y*h,e.x*h,e.y*h,s,0,2*Math.PI),t.fill()):n&&(t.font="".concat(r,"px serif"),t.save(),t.translate(h*i.x,h*i.y),t.rotate(a),t.textAlign="center",t.fillText(n,0,0),t.restore())}},{key:"updatePosition",value:function(t,i){var e=this.confettiSpeed,o=this.dragForceCoefficient,n=this.finalConfettiSpeedX,s=this.radiusYUpdateDirection,a=this.rotationSpeed,r=this.createdAt,h=this.direction,c=i-r;e.x>n&&(this.confettiSpeed.x-=o*t),this.currentPosition.x+=e.x*("left"===h?-this.absCos:this.absCos)*t,this.currentPosition.y=this.initialPosition.y-e.y*this.absSin*c+.00125*Math.pow(c,2)/2,this.rotationSpeed-=this.emoji?1e-4:1e-5*t,this.rotationSpeed<0&&(this.rotationSpeed=0),this.emoji?this.emojiRotationAngle+=this.rotationSpeed*t%(2*Math.PI):"down"===s?(this.radius.y-=t*a,this.radius.y<=0&&(this.radius.y=0,this.radiusYUpdateDirection="up")):(this.radius.y+=t*a,this.radius.y>=this.initialRadius&&(this.radius.y=this.initialRadius,this.radiusYUpdateDirection="down"))}},{key:"getIsVisibleOnCanvas",value:function(t){return this.currentPosition.y<t+100}}]),i}();function c(){var t=document.createElement("canvas");return t.style.position="fixed",t.style.width="100%",t.style.height="100%",t.style.top="0",t.style.left="0",t.style.zIndex="1000",t.style.pointerEvents="none",document.body.appendChild(t),t}function d(t){var i=t.confettiRadius,e=void 0===i?6:i,o=t.confettiNumber,n=void 0===o?t.confettiesNumber||(t.emojis?40:250):o,s=t.confettiColors,r=void 0===s?a:s,h=t.emojis,c=void 0===h?t.emojies||[]:h,d=t.emojiSize,l=void 0===d?80:d;return t.emojies&&console.error("emojies argument is deprecated, please use emojis instead"),t.confettiesNumber&&console.error("confettiesNumber argument is deprecated, please use confettiNumber instead"),{confettiRadius:e,confettiNumber:n,confettiColors:r,emojis:c,emojiSize:l}}return function(){function i(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};t(this,i),this.canvas=e.canvas||c(),this.canvasContext=this.canvas.getContext("2d"),this.shapes=[],this.lastUpdated=(new Date).getTime(),this.iterationIndex=0,this.loop=this.loop.bind(this),requestAnimationFrame(this.loop)}return e(i,[{key:"loop",value:function(){var t,i,e,n,s,a=this;t=this.canvas,i=window.devicePixelRatio,e=getComputedStyle(t),n=o(e.getPropertyValue("width")),s=o(e.getPropertyValue("height")),t.setAttribute("width",(n*i).toString()),t.setAttribute("height",(s*i).toString());var r=(new Date).getTime(),h=r-this.lastUpdated,c=this.canvas.offsetHeight;this.shapes.forEach((function(t){t.updatePosition(h,r),t.draw(a.canvasContext)})),this.iterationIndex%100==0&&(this.shapes=this.shapes.filter((function(t){return t.getIsVisibleOnCanvas(c)}))),this.lastUpdated=r,this.iterationIndex++,requestAnimationFrame(this.loop)}},{key:"addConfetti",value:function(){for(var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},i=d(t),e=i.confettiRadius,o=i.confettiNumber,n=i.confettiColors,s=i.emojis,a=i.emojiSize,r=window.devicePixelRatio,c=this.canvas.width/r,l=this.canvas.height/r,u=5*l/7,f={x:0,y:u},p={x:c,y:u},m=0;m<o/2;m++)this.shapes.push(new h({initialPosition:f,direction:"right",confettiRadius:e,confettiColors:n,confettiNumber:o,emojis:s,emojiSize:a,canvasWidth:c})),this.shapes.push(new h({initialPosition:p,direction:"left",confettiRadius:e,confettiColors:n,confettiNumber:o,emojis:s,emojiSize:a,canvasWidth:c}))}}]),i}()}();
