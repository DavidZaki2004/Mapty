'use strict';

/* 
Ability to edit a workout
 - Add an edit button 
 - When completing a new edit, delete old save 
 - Option to backout
 - Create private EditID and EditingStatus = false on default
 - 

Ability to delete a workout
Ability to delete all workouts

Ability to sort workouts by certain fields

Re-build Running and Cycling objects coming from Local Storage;

More realisitc error and confirmation messages

Ability to Position the map to show all workouts
Ability to draw lines and shapes instead of just points
Geocode Location from Coordinates ("Run in Faro, Protugal")
Display weather data for workout time and place
*/

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
console.log(inputCadence);
class Workout {
  //class fields
  date = new Date();
  // we add to nothing to turn into a string then have the unique identifier be the last 10 numbers
  id = (Date.now() + '').slice(-10); // this returns the current timestamp instead of the name of the timezone etc.

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in minutes
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on 
    ${months[this.date.getMonth()]} ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration); // intializing it for *this* keyword
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration); // intializing it for *this* keyword
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const testRun1 = new Running([39, -12], 5.2, 24, 178);
// const testCycle2 = new Cycling([39, -12], 23, 95, 5123);
// console.log(testCycle2, testRun1);

//////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #mapZoomLevel = 13;
  #map;
  #mapEvent;
  #workouts = [];

  constructor() {
    //we now call and effectively run the program the second we initialize
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Submitting the form using enterKey
    form.addEventListener('submit', this._newWorkout.bind(this));

    // Cycling and Walking forms toggle
    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
  }

  _getPosition() {
    // getCurrentPosition takes 2 callback functions as perimeters, first one is the callback function that is called on success (whenever the browser successfully gets the users location), second callback is the error callback whenever the browser fails to get the location.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }

  _loadMap(pos) {
    //destructuring that will make a variable called latitude based on the latitude property of this object
    const { latitude } = pos.coords;
    const { longitude } = pos.coords;
    // console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    //pin placer / handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Load the markers AFTER map has loaded (Asynchronous loading)
    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work); // it wont load instantly since the Map itself hasn't loaded
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus(); // to get the user to get to typing immediately
  }

  _hideForm() {
    //Empty Inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    // Temporarily hide the form
    form.style.display = 'none';
    form.classList.add('hidden');

    // Show it again (for next use)
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    // Helper Function (check if input is a number)
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    // check if value is negative
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get Data from the form (the .value is a specified quality added manually in html)
    const type = inputType.value;
    const distance = +inputDistance.value; // we use + to convert to string immediately
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    // if activity is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        // we are using a guard clause where we check for the opposite of what we want
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if activity is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as marker
    this._renderWorkoutMarker(workout);

    //Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear Input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    //Clear intput fields
    inputCadence.value =
      inputDuration.value =
      inputDistance.value =
      inputElevation.value =
        '';
  }

  _renderWorkoutMarker(workout) {
    //Display marker
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  // render workouts on the sidebar
  _renderWorkout(workout) {
    // common part which then splits into the specifics below
    let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description} 
          <span class ="workout-edit"> <i class="fa fa-pencil"></i></span> 
          <span class="workout-delete"><i class="fa fa-trash-o"></i></span> 
          </h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
        `;
    }

    if (workout.type === 'cycling') {
      html += ` 
            <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>
          `;
    }
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animation: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  _editWorkout() {
    // get Workout info
  }

  // we can call app.reset in the console to delete the values held in local storage.
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
