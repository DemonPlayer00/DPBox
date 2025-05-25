function dynamicGrid_onresize(length) {
    let width = window.innerWidth - 20;
    let grid = document.querySelector('.grid-container');

    let columns = width / (170 + 10) >= 1 ? Math.floor(width / (170 + 10)) : 1;
    grid.style.gridTemplateColumns = `repeat(${columns > length ? length : columns}, 1fr)`;
}