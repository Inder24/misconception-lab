import {validateLesson} from './lesson-schema.js';

export class ExperimentBuildError extends Error {
  constructor(message, receipt) {
    super(message);
    this.name = 'ExperimentBuildError';
    this.receipt = receipt;
  }
}

// Execution happens through the injected sandbox. This module never evaluates code.
export async function buildCheckedLesson({endpoint, payload, request, check, signal, onProgress = () => {}}) {
  const receipt = [];
  const abort = () => signal?.throwIfAborted();
  const progress = (stage, attempt, detail, status = 'running') => {
    const event = {stage, attempt, detail, status, at: new Date().toISOString()};
    receipt.push(event);
    onProgress(event, [...receipt]);
  };
  abort();
  progress('build', 0, endpoint === '/api/revise' ? 'Building the requested variation' : 'Designing an experiment for your claim');
  let candidate = await request(endpoint, payload, {signal});
  for (let attempt = 0; attempt <= 2; attempt++) {
    abort();
    if (!validateLesson(candidate?.lesson)) throw new ExperimentBuildError('The generated lesson could not be read. Your current experiment is still available.', receipt);
    progress('test', attempt, 'Running the experiment across controls, sizes, and replay positions');
    let runtime;
    try {
      runtime = await check(candidate.lesson, {signal, onProgress});
    } catch (error) {
      abort();
      runtime = {passed:false, checks:[{name:'Sandbox execution',passed:false,detail:error.message || 'The experiment could not execute'}],runs:[]};
    }
    abort();
    const failures = (runtime.checks || []).filter(x => !x.passed).map(x => ({name:x.name, detail:x.detail}));
    let review = null;
    if (runtime.passed) {
      progress('test', attempt, `${runtime.runs.length} execution cases passed`, 'passed');
      progress('review', attempt, 'Reviewing the science, questions, and measured results');
      review = await request('/api/review', {lesson:candidate.lesson, runs:runtime.runs}, {signal});
      abort();
      if (!review?.passed) failures.push(...(review?.issues?.length ? review.issues : [{name:'Scientific review',detail:review?.summary || 'The review did not pass'}]));
    }
    if (runtime.passed && review?.passed) {
      progress('ready', attempt, review.summary || 'Execution checks and model review passed', 'passed');
      return {...candidate, validation:{runtime, review, repairs:attempt, checkedAt:new Date().toISOString(), receipt}};
    }
    const firstFailure=failures[0]?.detail||'The candidate did not pass checks';
    progress('check', attempt, firstFailure, 'failed');
    if (attempt === 2) throw new ExperimentBuildError(`This experiment could not finish after two repairs. ${firstFailure.split('; params=')[0].slice(0,400)} Your idea is kept so you can try again.`, receipt);
    abort();
    progress('repair', attempt + 1, `Repair ${attempt + 1} of 2: correcting the observed failures`);
    const evidence = failures.length ? failures.slice(0, 40) : [{name:'Execution',detail:'The test matrix did not pass'}];
    candidate = await request('/api/repair', {claim:payload.claim || candidate.lesson.claim, lesson:candidate.lesson, failures:evidence, attempt:attempt + 1,...(payload.brief?{brief:payload.brief}:{})}, {signal});
  }
}
