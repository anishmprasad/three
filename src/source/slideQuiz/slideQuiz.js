export default class SlideQuiz {
  constructor(data) {
    this.isSlideQuiz = true;
    this.active = data ? data.active : false;
    this.type = data ? data.type : "radio";
    this.required = data ? data.required : false;
    this.score = data ? data.score : 100;
    this.numerator = ( data && data.numerator) ? data.numerator : 0;
    this.denominator = ( data && data.denominator ) ? data.denominator : 1;
    this.score = data ? data.score : 100;
    this.userScore = 0;
    this.timeLimitEnabled = data ? data.timeLimitEnabled : false;
    this.scoreBasedActionEnabled = data ? data.scoreBasedActionEnabled : false;
    this.scoreActions = (data && data.scoreActions) ? data.scoreActions : [{
        sign: "<=",
        scoreCondition: 0,
        scoreActionSlide: 0
      }];
    this.timeLimit = data ? data.timeLimit : 0;
    this.answers = data ? data.answers : ["", "", ""];
    this.meshes = (data && data.meshes) ? data.meshes : [];
    this.nodes = (data && data.nodes) ? data.nodes : [];
    this.connections = (data && data.connections) ? data.connections : [];
    this.labels = (data && data.labels) ? data.labels : {};
    this.rightAnswer = data ? data.rightAnswer : "";
    this.slide = data ? data.slide : Q3.slide;
    this.question = data ? data.question : "";
    this.position = data ? data.position : {x: 0, y: 0};
  }
}


// WEBPACK FOOTER //
// ./src/Q3/slideQuiz/slideQuiz.js