import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { SiteContentService } from './site-content.service';

/** Lets any effect-scheduled setTimeout(0) work run before we assert. */
const flushDeferred = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render Gencolink hero', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Building software that powers a');
  });

  // Regression test. Rows are opacity:0 until IntersectionObserver adds
  // .animate-in-view, so any DOM rendered after the last observation pass stays
  // permanently invisible. When the Directus fetch FAILS, SiteContentService
  // keeps the default content, so content() never changes - only loading()
  // flips, and that flip is what swaps skeletons for the real rows. If the
  // reveal effect tracks content() alone it never re-runs here, and every
  // section renders blank except the hero (which isn't behind the loading gate).
  it('re-runs scroll-reveal setup when the CMS fetch fails and only loading settles', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const store = TestBed.inject(SiteContentService);

    // Put the component back into the "CMS still in flight" state and let the
    // initial effect pass complete. Flushing here matters: the effect defers
    // via setTimeout(0), and that pending call would otherwise land after the
    // spy is installed and pass the test for the wrong reason.
    store.loading.set(true);
    fixture.detectChanges();
    await flushDeferred();

    const contentBefore = store.content();
    const spy = spyOn(app, 'setupScrollAnimation');

    // Simulate the failure path: content is left untouched, loading settles.
    store.loading.set(false);
    fixture.detectChanges();
    await flushDeferred();

    expect(store.content()).toBe(contentBefore); // content really did not change
    expect(spy).toHaveBeenCalled(); // ...yet the new rows still got observed
  });

  it('still renders the default services when the CMS is unreachable', () => {
    const fixture = TestBed.createComponent(App);
    const store = TestBed.inject(SiteContentService);

    store.loading.set(false); // fetch settled (failed); defaults retained
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('.service-row:not(.service-row--skeleton)');
    expect(rows.length).toBeGreaterThan(0);
  });
});
