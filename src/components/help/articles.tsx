import {
  Lede, Q, Steps, Step, Demo, GuestView, Pin, Callouts, Note, See,
  Field, Row, Btn, Chip, Card, Table, Phone,
} from "./Bits";

/**
 * The articles.
 *
 * Written for someone who has never seen EventOS and is not technical. The
 * rules the prose follows, so later additions match:
 *
 *  - Say what the planner sees, not what the system does. "Add your guests"
 *    rather than "populate the guest collection".
 *  - Every article answers the same four questions in the same order, so
 *    someone who has read one knows how to skim the next.
 *  - Steps are things you can do with a mouse. If a step cannot be followed
 *    without knowing something the article has not said, the article is wrong.
 *  - Examples are the product's own components (see `Bits.tsx`), used where
 *    they tell you where to click, and left out where they would just decorate
 *    a paragraph that was already clear.
 *  - Nothing is described that the product does not do.
 */

/* ═════════════════════════════════════════════════ 1 · first wedding ═══ */

function CreatingYourFirstWedding() {
  return (
    <>
      <Lede>
        A wedding in EventOS is one record that holds everything about one
        couple&rsquo;s day — their website, their guest list, the running order,
        the seating, the gifts and every reply. You make one, fill it in over
        time, and publish it when it is ready.
      </Lede>

      <Q q="What is it?">
        <p>
          Think of it as a folder for one wedding. Everything you add later —
          guests, events, photographs — goes inside it. You can have as many
          weddings as you have couples, and they never mix.
        </p>
        <p>
          A new wedding starts as a <b>draft</b>. Nobody outside your studio can
          see a draft. It is yours to work on for as long as you need.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because the alternative is a spreadsheet for the guests, a document for
          the timeline, a group chat for the seating and an email thread for the
          replies. One record means when the date moves, it moves everywhere.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>In the sidebar on the left, click <b>Weddings</b>.</Step>
          <Step>Click <b>New wedding</b> at the top right.</Step>
          <Step>
            Type both partners&rsquo; first names and pick the date. These are the
            only two things you need to begin — everything else can wait.
          </Step>
          <Step>Choose a template. You can change it later, so pick the one that feels closest.</Step>
          <Step>Click <b>Create wedding</b>.</Step>
        </Steps>

        <Demo label="Starting a new wedding">
          <Card>
            <Row>
              <Field label="Partner one" value="Ada" />
              <Field label="Partner two" value="Grace" />
            </Row>
            <Row>
              <Field label="Wedding date" value="12 June 2027" />
              <Field label="Venue" placeholder="The Old Rectory" />
            </Row>
            <div className="help-actions">
              <Btn kind="outline">Cancel</Btn>
              <Btn>Create wedding <Pin n={1} /></Btn>
            </div>
          </Card>
        </Demo>
        <Callouts>
          <li>
            Creates the wedding and opens it. Nothing is public yet — see{" "}
            <See to="publishing-your-wedding">Publishing your wedding</See>.
          </li>
        </Callouts>

        <p>
          You land on the wedding&rsquo;s own page. Every part of the wedding is
          reachable from here, and you can leave and come back at any point.
          Nothing needs finishing in one sitting.
        </p>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Nothing at all, yet. A draft wedding has no public address and does not
          appear anywhere. Guests only ever see a wedding you have published, and
          only through their own invitation link.
        </p>
      </Q>
    </>
  );
}

/* ═══════════════════════════════════════════════════ 2 · template ═══ */

const TEMPLATE_ROWS: [string, string][] = [
  ["Modern Sage", "Clean and current, in soft green. The safe choice when you are not sure."],
  ["Pacific Linen", "Bright and textured, like a signature on good paper. Lots of air."],
  ["Classic Elegance", "Traditional, in red and cream. Reads formal without reading old."],
  ["Blush Romance", "Soft pink, delicate detailing. The most romantic of the six."],
  ["Midnight Bloom", "Near-black and botanical. Photographs lit out of the dark."],
  ["Velvet Botanical", "Burgundy and cream, a painted still life, deep shadow. The most dramatic."],
];

function ChoosingATemplate() {
  return (
    <>
      <Lede>
        A template is the design of the couple&rsquo;s website and their
        invitation — the colours, the typefaces and the way a page is laid out.
        There are six. You pick one, and everything the guest sees follows it.
      </Lede>

      <Q q="What is it?">
        <p>
          The same information — names, date, schedule, photographs — arranged
          six different ways. Choosing a template does not change what is on the
          website. It changes how it feels.
        </p>
        <Table
          head={["Template", "Suits"]}
          rows={TEMPLATE_ROWS.map(([name, suits]) => [<b key={name}>{name}</b>, suits])}
        />
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because a couple who love their invitation share it, and a couple who
          are embarrassed by it do not. The template is the first thing a guest
          sees and most of what they remember.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding.</Step>
          <Step>Find the <b>Template</b> setting on the wedding&rsquo;s details.</Step>
          <Step>Pick one. The preview updates so you can see it before you commit.</Step>
          <Step>Save.</Step>
        </Steps>
        <Note title="You can change your mind">
          Switching template keeps every word, photograph and guest exactly as it
          is. Only the design changes. Try two and show the couple both.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          The template, everywhere: in the invitation email that arrives, on the
          page they open, and on the wedding website itself. It is one look from
          the first email to the morning of the day.
        </p>
      </Q>
    </>
  );
}

/* ════════════════════════════════════════════════════ 3 · details ═══ */

function AddingWeddingDetails() {
  return (
    <>
      <Lede>
        The facts of the day: who is getting married, when, where, and the story
        that opens their website.
      </Lede>

      <Q q="What is it?">
        <p>
          One form holding everything about the wedding that is not a guest, an
          event or a photograph. Names, date, venue, city, address, and a piece
          of writing about the couple.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because these details are used in more places than you would type them.
          The date drives the countdown, the venue drives the map link on every
          event, and the names appear on the invitation, the website, the emails
          and the calendar entries guests save to their phones.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and find the details form.</Step>
          <Step>
            Fill in the <b>venue</b> and <b>city</b>. Add the full street address
            too — that is what turns a venue name into a working map link for
            guests.
          </Step>
          <Step>
            Check the <b>time zone</b>. EventOS works it out from the city you
            typed, and you can override it. This matters more than it looks:
            times are shown to each guest correctly wherever they are, and that
            only works if the venue&rsquo;s zone is right.
          </Step>
          <Step>Write the <b>story</b> if the couple want one. It is optional.</Step>
          <Step>Save.</Step>
        </Steps>

        <Demo label="Venue and time zone">
          <Card>
            <Field label="Venue" value="The Old Rectory" />
            <Row>
              <Field label="City" value="Siena" />
              <Field label="Time zone" value="Europe/Rome" hint="Filled in from the city. Change it if the venue is elsewhere." />
            </Row>
            <Field
              label="Full address"
              value="Via di Vallerozzi 12, 53100 Siena SI, Italy"
              hint="Used for the map link guests tap on every event."
            />
          </Card>
        </Demo>

        <Note tone="warn" title="If you change the time zone later">
          Every event keeps the clock time you typed. A 2:00 PM ceremony stays at
          2:00 PM in the new zone rather than sliding to a different hour. That
          is almost always what you meant — but do glance at the schedule
          afterwards.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          The names and date at the top of the website, a countdown if that
          section is switched on, and the venue with a working map link beside
          every event they are invited to.
        </p>
      </Q>
    </>
  );
}

/* ═══════════════════════════════════════════════════ 4 · branding ═══ */

function BrandingYourWedding() {
  return (
    <>
      <Lede>
        Your studio&rsquo;s name, logo, colour and typeface — carried across every
        wedding you run and every email that goes out. Guests see your studio,
        not ours.
      </Lede>

      <Q q="What is it?">
        <p>
          Branding is set once, in <b>Settings</b>, and applies everywhere. It is
          not per wedding: it is who <i>you</i> are, sitting behind all of them.
        </p>
        <p>Four things: your studio name, your logo, an accent colour, and a typeface.</p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because the couple hired you. An invitation that arrives with a
          software company&rsquo;s name on it quietly tells every guest that you
          bought something off a shelf. With branding set, the guest sees your
          letterhead and has no reason to think about the tool at all.
        </p>
        <p>
          The contact address matters just as much: when a guest hits reply on an
          invitation, it should reach you.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Click <b>Settings</b> in the sidebar.</Step>
          <Step>Type your <b>studio name</b> as you want it to read on an email.</Step>
          <Step>
            Upload your <b>logo</b>. A PNG with a transparent background works
            best. Under 4 MB, and not an SVG.
          </Step>
          <Step>Pick your <b>accent colour</b> and a <b>typeface</b>.</Step>
          <Step>
            Add a <b>contact email</b>. This is where guest replies go.
          </Step>
          <Step>Save. Every wedding updates at once.</Step>
        </Steps>

        <Demo label="Settings → branding">
          <Card>
            <Row>
              <Field label="Studio name" value="Wren & Ivy" />
              <Field label="Contact email" value="hello@wrenandivy.com" hint="Where guest replies land." />
            </Row>
            <Row>
              <Field label="Accent colour" value="#9D5C64" />
              <Field label="Typeface" value="Classic" />
            </Row>
          </Card>
        </Demo>
      </Q>

      <Q q="What does the guest see?">
        <GuestView label="An invitation email arriving">
          <Phone>
            <div className="help-mail">
              <div className="help-mail-logo">WREN &amp; IVY</div>
              <p className="help-mail-h">Ada &amp; Grace</p>
              <p className="help-mail-b">
                You are invited. Everything you need is on your own page — the
                schedule, directions, and where you are sitting.
              </p>
              <span className="help-mail-btn">Open your invitation</span>
              <p className="help-mail-f">Reply to this email to reach us directly.</p>
            </div>
          </Phone>
        </GuestView>
        <p>
          Your name at the top, your colour on the button, and a reply address
          that reaches you. EventOS is not mentioned.
        </p>
      </Q>
    </>
  );
}

/* ═════════════════════════════════════════════════════ 5 · guests ═══ */

function ManagingGuests() {
  return (
    <>
      <Lede>
        Everyone invited, in one list. Add them one by one, or paste in a whole
        list at once.
      </Lede>

      <Q q="What is it?">
        <p>
          A guest is a name, and optionally an email address, a phone number and
          some groups. Each guest also gets their own private invitation link,
          created automatically — you never make these yourself.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          The guest list drives almost everything else. Seating comes from it,
          RSVPs come from it, and who is told about which event comes from it.
          Get the list in early and the rest gets easier.
        </p>
      </Q>

      <Q q="How does it work?">
        <p><b>One at a time</b></p>
        <Steps>
          <Step>Open the wedding and click <b>Guests</b>.</Step>
          <Step>Type the guest&rsquo;s name. Add their email if you have it.</Step>
          <Step>Tick any groups that apply.</Step>
          <Step>Click <b>Add guest</b>.</Step>
        </Steps>

        <Demo label="Adding one guest">
          <Card>
            <Row>
              <Field label="Name" value="Marianne Okafor" />
              <Field label="Email" value="marianne@example.com" hint="Optional. Without it, share their link yourself." />
            </Row>
            <div className="help-groups">
              <Chip tone="sage">Family</Chip>
              <Chip>Close Friends</Chip>
              <Chip>Friends</Chip>
              <Chip>Bridesmaids</Chip>
              <Chip>VIP</Chip>
              <Pin n={1} />
            </div>
            <div className="help-actions"><Btn>Add guest</Btn></div>
          </Card>
        </Demo>
        <Callouts>
          <li>
            Tick as many as apply. See{" "}
            <See to="creating-groups">Creating groups</See>.
          </li>
        </Callouts>

        <p><b>A whole list at once</b></p>
        <p>
          If the couple sent you a spreadsheet, you do not need to retype it.
          Paste it in, one guest per line:
        </p>
        <Demo label="Importing a list">
          <div className="help-code">
            Marianne Okafor, marianne@example.com, Family<br />
            Tom Reilly, tom@example.com, Friends|Groomsmen<br />
            Aunt Bea, , Family
          </div>
        </Demo>
        <p>
          Name first, then email, then groups separated by a vertical bar.
          Leave the email blank if you do not have one — the comma still goes in.
          EventOS tells you how many were added and how many lines it skipped.
        </p>

        <Note title="Guests without an email address">
          Perfectly fine. They still get an invitation link; you just send it to
          them yourself — by message, by hand, printed on a card.
        </Note>

        <p><b>Taking the list away with you</b></p>
        <p>
          <b>Export</b> downloads the whole list as a spreadsheet: names, groups,
          replies, meal choices and dietary notes. Useful for a caterer, or a
          venue that wants numbers.
        </p>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Their own name, and only their own information. One guest can never see
          the guest list, anyone else&rsquo;s reply, or anyone else&rsquo;s
          contact details.
        </p>
      </Q>
    </>
  );
}

/* ═════════════════════════════════════════════════════ 6 · groups ═══ */

function CreatingGroups() {
  return (
    <>
      <Lede>
        Labels you put on guests — Family, Bridesmaids, Colleagues — so you can
        tell one part of the guest list about something without telling everyone.
      </Lede>

      <Q q="What is it?">
        <p>There are eight to choose from, and a guest can be in as many as you like:</p>
        <div className="help-groups">
          <Chip tone="sage">Family</Chip>
          <Chip tone="sage">Close Friends</Chip>
          <Chip tone="sage">Friends</Chip>
          <Chip tone="sage">Bridesmaids</Chip>
          <Chip tone="sage">Groomsmen</Chip>
          <Chip tone="sage">Colleagues</Chip>
          <Chip tone="sage">VIP</Chip>
          <Chip tone="sage">Vendors</Chip>
        </div>
        <p>
          Someone can be Family <i>and</i> a Bridesmaid. They will see anything
          meant for either.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Most weddings have events that are not for everybody. The rehearsal
          dinner is for family. The morning-after brunch is for people who stayed
          over. Suppliers need the loading time and nobody else does.
        </p>
        <p>
          Without groups you have two bad options: tell everyone about everything
          and field the questions, or send separate messages outside the system
          and hope you got the list right. Groups mean each guest opens their
          link and sees the day <i>they</i> were invited to.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Tick groups on each guest as you add them, or edit a guest later.</Step>
          <Step>
            When you build an event, choose whether it is for everyone or for
            particular groups — see{" "}
            <See to="building-the-schedule">Building the schedule</See>.
          </Step>
          <Step>That is all. Each guest&rsquo;s page assembles itself.</Step>
        </Steps>
        <p>
          You can also filter the guest list by group, which is the fastest way to
          check you have not missed anyone before invitations go out.
        </p>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Never the group names, and never that groups exist. A guest sees a
          schedule that looks like it was written for them. Someone in Family sees
          the rehearsal dinner; someone in Colleagues opens the same link and it
          is simply not there.
        </p>
      </Q>
    </>
  );
}

/* ═══════════════════════════════════════════════════ 7 · schedule ═══ */

function BuildingTheSchedule() {
  return (
    <>
      <Lede>
        Every part of the day, in order — ceremony, drinks, dinner, dancing — with
        times, places, dress codes, and who is told about each one.
      </Lede>

      <Q q="What is it?">
        <p>
          A list of events. Each has a title, a date and time, and optionally a
          place, a description and a dress code. The order you put them in is the
          order guests read them.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          It is the single most-used page of any wedding website. Guests check it
          the week before to know what to wear, the night before to know when to
          arrive, and on the morning to find the venue. A schedule that is right,
          and personal to them, removes most of the questions you would otherwise
          be answering by text.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and click <b>Schedule</b>.</Step>
          <Step>Click <b>Add event</b>.</Step>
          <Step>
            Give it a title and a date. Add a start time, and an end time if it
            matters.
          </Step>
          <Step>
            Add the place. If it is not the main venue, put the full address in so
            the map link works.
          </Step>
          <Step>
            Decide who it is for: <b>everyone</b>, or particular <b>groups</b>.
          </Step>
          <Step>Save, and repeat. Drag to reorder.</Step>
        </Steps>

        <Demo label="Adding an event">
          <Card>
            <Field label="Title" value="Rehearsal dinner" />
            <Row>
              <Field label="Date" value="11 June 2027" />
              <Field label="Start" value="19:30" />
            </Row>
            <Field label="Where" value="Trattoria del Borgo, Siena" />
            <Field label="Dress code" value="Smart casual" />
            <div className="help-audience">
              <span className="help-hint">Who can see this</span>
              <div className="help-groups">
                <Chip>Everyone</Chip>
                <Chip tone="sage">Family</Chip>
                <Chip tone="sage">Bridesmaids</Chip>
                <Chip>Friends</Chip>
                <Pin n={1} />
              </div>
            </div>
            <div className="help-actions"><Btn>Save event</Btn></div>
          </Card>
        </Demo>
        <Callouts>
          <li>
            With Family and Bridesmaids picked, only those guests see this event.
            Leave it on <b>Everyone</b> and it appears for the whole list.
          </li>
        </Callouts>

        <Note title="Times are the venue's local time">
          Type the time as it will be on the clock at the venue. Guests see it
          correctly wherever in the world they open it.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <GuestView label="A guest's own schedule">
          <Phone>
            <div className="help-sched">
              <div className="help-sched-day">Friday, 11 June</div>
              <div className="help-sched-row">
                <b>7:30 PM</b>
                <div>
                  <span>Rehearsal dinner</span>
                  <em>Trattoria del Borgo · Smart casual</em>
                </div>
              </div>
              <div className="help-sched-day">Saturday, 12 June</div>
              <div className="help-sched-row">
                <b>3:00 PM</b>
                <div>
                  <span>Ceremony</span>
                  <em>The Old Rectory</em>
                </div>
              </div>
              <div className="help-sched-row">
                <b>7:00 PM</b>
                <div>
                  <span>Dinner &amp; dancing</span>
                  <em>The Long Barn · Black tie</em>
                </div>
              </div>
            </div>
          </Phone>
        </GuestView>
        <p>
          Grouped by day, in your order, with a map link on any event that has an
          address. A guest not in Family would open the same link and see
          Saturday only.
        </p>
      </Q>
    </>
  );
}

/* ════════════════════════════════════════════════════ 8 · seating ═══ */

function Seating() {
  return (
    <>
      <Lede>
        Tables for each event, and who sits at them. Seating belongs to an event,
        not to the wedding — the dinner and the brunch can seat people
        differently.
      </Lede>

      <Q q="What is it?">
        <p>
          For any event you choose, a set of tables with a name and a number of
          seats. You put guests at them. A guest can hold one seat per event.
        </p>
        <p>
          Up to 60 tables per event, up to 30 seats each — far past any real
          wedding, and there so a mistyped number cannot create a thousand tables.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Seating is the job couples dread and change most often. Doing it here
          rather than on paper means every change is instantly right on every
          guest&rsquo;s page, and nobody is hunting a board on the night.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and click <b>Seating</b>.</Step>
          <Step>Pick the event you are seating.</Step>
          <Step>Add a table: give it a name and how many it seats.</Step>
          <Step>Drag guests from <b>Not yet seated</b> onto a table.</Step>
          <Step>Repeat for any other event that needs its own plan.</Step>
        </Steps>

        <Demo label="The seating board">
          <div className="help-seating">
            <div className="help-seat-col">
              <div className="help-seat-h">Not yet seated <span>12</span></div>
              <div className="help-seat-guest">Marianne Okafor</div>
              <div className="help-seat-guest">Tom Reilly</div>
              <div className="help-seat-guest">Aunt Bea</div>
            </div>
            <div className="help-seat-tables">
              <Card>
                <div className="help-seat-h">Top table <span>6 / 8</span></div>
                <div className="help-seat-guest">Ada</div>
                <div className="help-seat-guest">Grace</div>
                <div className="help-seat-guest">Nour Haddad</div>
              </Card>
              <Card>
                <div className="help-seat-h">Table 2 <span>8 / 8</span></div>
                <div className="help-seat-guest">Priya Raman</div>
                <div className="help-seat-guest">Jonah Weiss</div>
              </Card>
            </div>
          </div>
        </Demo>

        <Note title="A full table says so">
          You cannot seat a ninth guest at an eight-seat table, and you cannot
          shrink a table below the number already sitting at it. EventOS asks you
          to move someone first rather than quietly dropping them.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Their table, on their own page — <i>&ldquo;You are at Table 4&rdquo;</i>{" "}
          — for each event where you have seated them. They do not see the plan,
          the other tables, or who else is where.
        </p>
      </Q>
    </>
  );
}

/* ═════════════════════════════════════════════════════ 9 · photos ═══ */

function PhotosAndGallery() {
  return (
    <>
      <Lede>
        Photographs go in four places, each doing a different job. Upload once and
        EventOS prepares every size the website needs.
      </Lede>

      <Q q="What is it?">
        <Table
          head={["Where", "How many", "What it is for"]}
          rows={[
            [<b key="h">Hero</b>, "1", "The big image at the top. The first thing anyone sees."],
            [<b key="c">Couple</b>, "up to 6", "Portraits, shown under the invitation."],
            [<b key="s">Story</b>, "up to 4", "Sits beside the couple's written story."],
            [<b key="g">Gallery</b>, "up to 40", "The full album, if the Gallery section is on."],
          ]}
        />
      </Q>

      <Q q="Why would I use it?">
        <p>
          A wedding website without photographs is a form. One good landscape
          photograph at the top does more for how the couple feel about their site
          than any other single thing you can add.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and click <b>Photos</b>.</Step>
          <Step>Choose the place you are filling — Hero, Couple, Story or Gallery.</Step>
          <Step>Upload. JPEG, PNG, WebP, AVIF or HEIC, up to 4 MB, at least 400×400.</Step>
          <Step>
            Write a short <b>description</b> of what is in the picture. This is
            read aloud to guests using a screen reader.
          </Step>
          <Step>Reorder with the arrows. The first Gallery photo leads the album.</Step>
        </Steps>
        <p>
          Landscape works best for the Hero; portraits work best for Couple. Every
          upload is resized and re-saved for fast loading, so a large photograph
          straight off a camera is fine.
        </p>
        <Note tone="warn" title="Removing a photo is permanent">
          There is no undo, and EventOS does not keep a copy. Keep your originals.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          The Hero fills the top of the website. Couple photographs sit under the
          invitation, Story photographs beside the story, and the Gallery appears
          as its own section — but only if you have switched Gallery on in the
          wedding&rsquo;s sections.
        </p>
      </Q>
    </>
  );
}

/* ═══════════════════════════════════════════════════ 10 · registry ═══ */

function RegistryAndCashGifts() {
  return (
    <>
      <Lede>
        A wishlist of things guests can buy, and funds for guests who would rather
        give money. Both optional, both switched on per wedding.
      </Lede>

      <Q q="What is it?">
        <p>
          <b>Registry items</b> are links to real products at real shops. EventOS
          does not sell anything and takes no payment — a guest clicks through to
          the retailer and buys it there, then marks it as bought so nobody buys
          it twice.
        </p>
        <p>
          <b>Cash funds</b> are a name, a short description, and your own payment
          links — Venmo, PayPal or Stripe. The money goes straight to the couple.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because the alternative is a wishlist on a shop&rsquo;s website that does
          not match the invitation, or an awkward line about money in a group
          chat. Having both in one place, in the couple&rsquo;s own design, is
          kinder to guests and to the couple.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and click <b>Registry</b>.</Step>
          <Step>Paste the full product link, including the https:// part.</Step>
          <Step>
            Give it a title and a price. EventOS works out the shop&rsquo;s name
            from the link.
          </Step>
          <Step>Mark up to three as <b>featured</b> — those get a mention on the invitation.</Step>
          <Step>For a cash fund, add a name, a line about what it is for, and your payment link.</Step>
          <Step>
            Switch on the <b>Registry</b> and <b>Cash gifts</b> sections so they
            appear on the website.
          </Step>
        </Steps>

        <Demo label="The registry list">
          <Card>
            <Table
              head={["Gift", "Price", "Status"]}
              rows={[
                ["Copper pans", "£180", <Chip key="a">Available</Chip>],
                ["Linen tablecloth", "£65", <Chip key="b" tone="sage">Bought by Marianne</Chip>],
                ["Weekend in Bath", "£240", <Chip key="c">Available</Chip>],
              ]}
            />
          </Card>
        </Demo>

        <Note title="If two guests buy the same thing">
          Only the first claim is recorded, even if two people click at the same
          moment. The second guest is told who got there first and can tell the
          couple if they bought it anyway. You can release a gift back onto the
          list at any point.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          The whole list, with bought items still visible and marked. That is
          deliberate: a guest arriving at a nearly-empty list cannot tell whether
          the couple asked for little or whether everything has gone. Seeing most
          of it spoken for reads as reassuring.
        </p>
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════════ 11 · rsvps ═══ */

function Rsvps() {
  return (
    <>
      <Lede>
        Replies as they come in — who is coming, what they want to eat, and
        anything they need you to know.
      </Lede>

      <Q q="What is it?">
        <p>Each guest can send one reply. It holds:</p>
        <ul className="help-list">
          <li>Whether they are coming — <b>Accepted</b>, <b>Declined</b> or <b>Maybe</b></li>
          <li>A meal choice, if the couple offer one</li>
          <li>Dietary requirements</li>
          <li>A note to the couple</li>
        </ul>
        <p>A guest can come back and change their reply. The latest one stands.</p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because the caterer needs numbers and the venue needs a final count, and
          chasing those through email is where weekends go. Everything lands in
          one list you can hand over.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Open the wedding and click <b>RSVPs</b>.</Step>
          <Step>Read the replies. They appear the moment a guest sends one.</Step>
          <Step>
            Use <b>Export</b> on the Guests page to download everything as a
            spreadsheet for the caterer.
          </Step>
        </Steps>

        <Demo label="Replies coming in">
          <Card>
            <Table
              head={["Guest", "Reply", "Meal", "Dietary"]}
              rows={[
                ["Marianne Okafor", <Chip key="a" tone="sage">Accepted</Chip>, "Fish", "—"],
                ["Tom Reilly", <Chip key="b" tone="sage">Accepted</Chip>, "Beef", "No dairy"],
                ["Aunt Bea", <Chip key="c" tone="wine">Declined</Chip>, "—", "—"],
                ["Priya Raman", <Chip key="d" tone="wine">Maybe</Chip>, "Vegetarian", "Coeliac"],
              ]}
            />
          </Card>
        </Demo>

        <Note title="Nobody needs an account">
          A guest replies straight from their invitation link. No password, no
          sign-up, nothing to install — which is most of the reason replies
          actually arrive.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          A short form on their own page, already knowing who they are, and a
          confirmation email afterwards with your studio&rsquo;s name on it. If
          they change their mind they open the same link and change their answer.
        </p>
      </Q>
    </>
  );
}

/* ═════════════════════════════════════════════════ 12 · publishing ═══ */

function PublishingYourWedding() {
  return (
    <>
      <Lede>
        Publishing turns a draft into a real website with its own address, and
        lets you send invitations. Until you publish, nothing is visible to
        anyone.
      </Lede>

      <Q q="What is it?">
        <p>
          A wedding is either a <b>draft</b> or <b>published</b>. Draft means
          yours alone. Published means it has a public address and invitation
          links work.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          It is the line between working on something and showing it. Everything
          before publishing can be half-finished without anyone seeing a
          half-finished thing.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>
            <b>Preview it first.</b> Open the wedding and click <b>Preview</b> to
            see exactly what a guest will see.
          </Step>
          <Step>Check the sections you have switched on — countdown, travel, FAQ, registry, cash gifts, gallery.</Step>
          <Step>Click <b>Publish</b>.</Step>
          <Step>
            Your first wedding is free. After that, publishing takes a payment —
            you will be asked at this point.
          </Step>
          <Step>
            Once published, go to <b>Guests</b> and send invitations. See{" "}
            <See to="the-guest-experience">Understanding the guest experience</See>.
          </Step>
        </Steps>

        <Demo label="Before you publish">
          <Card>
            <div className="help-check">
              <div><Chip tone="sage">Done</Chip> Names, date and venue</div>
              <div><Chip tone="sage">Done</Chip> Hero photograph</div>
              <div><Chip tone="sage">Done</Chip> Schedule — 4 events</div>
              <div><Chip>To do</Chip> Guests — 0 added</div>
            </div>
            <div className="help-actions">
              <Btn kind="outline">Preview</Btn>
              <Btn>Publish</Btn>
            </div>
          </Card>
        </Demo>

        <Note title="Publishing is not the end">
          You can keep editing afterwards and changes appear straight away. See{" "}
          <See to="managing-your-published-website">
            Managing your published website
          </See>.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Nothing until you send invitations. Publishing makes the site
          <i> reachable</i>; it does not announce it. Sending invitations is a
          separate, deliberate step.
        </p>
      </Q>
    </>
  );
}

/* ════════════════════════════════════════════ 13 · guest experience ═══ */

function TheGuestExperience() {
  return (
    <>
      <Lede>
        Every guest gets their own link. It opens a page built for them — their
        schedule, their table, their RSVP. No two guests necessarily see the same
        thing.
      </Lede>

      <Q q="What is it?">
        <p>
          When you add a guest, EventOS creates a private link just for them. It
          is their key: it identifies them, so they never sign in, never make an
          account and never type a password.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because anything a guest has to install or sign up for, a good number of
          them will not. One link they tap once is the difference between
          two-thirds of your replies arriving and all of them.
        </p>
        <p>
          And because the same link can say different things to different people,
          you can run a complicated wedding without sending five versions of an
          email.
        </p>
      </Q>

      <Q q="How does it work?">
        <Steps>
          <Step>Publish the wedding.</Step>
          <Step>Open <b>Guests</b> and click <b>Send invitations</b>.</Step>
          <Step>
            Every guest with an email address gets one, sent steadily rather than
            all at once so they arrive as post rather than as a blast.
          </Step>
          <Step>
            Guests without an email address are marked as invited — copy their
            link and send it yourself.
          </Step>
        </Steps>
        <p>
          Nobody is emailed twice. If you press the button again, only guests who
          have not yet been sent one receive anything.
        </p>
        <Note tone="warn" title="Treat the link like a key">
          Anyone holding a guest&rsquo;s link can see that guest&rsquo;s page and
          reply as them. That is the trade that removes passwords, and it is the
          right one for a wedding — but it is why links should be sent to a
          person, not posted in a public group.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>Depending on what you have filled in, their page can include:</p>
        <ul className="help-list">
          <li>Their invitation, with their name on it</li>
          <li>Their own schedule — only the events their groups can see</li>
          <li>Where each event is, with a map link</li>
          <li>A button to add the day to the calendar on their phone</li>
          <li>The couple&rsquo;s story and photographs</li>
          <li>Which table they are at, for each event</li>
          <li>Their RSVP — meal, dietary needs, a note</li>
          <li>The registry and any cash funds</li>
        </ul>

        <GuestView label="A guest's own page">
          <Phone>
            <div className="help-portal">
              <div className="help-portal-h">
                <em>You are invited</em>
                <b>Ada &amp; Grace</b>
                <span>12 June 2027 · The Old Rectory, Siena</span>
              </div>
              <div className="help-portal-card">
                <em>Marianne</em>
                <span>Will you join us?</span>
                <div className="help-portal-btns">
                  <span className="on">Yes</span><span>No</span><span>Maybe</span>
                </div>
              </div>
              <div className="help-portal-card">
                <em>Your table</em>
                <span>Table 4, for the dinner</span>
              </div>
              <div className="help-portal-card">
                <em>Your schedule</em>
                <span>3:00 PM Ceremony · 7:00 PM Dinner</span>
              </div>
            </div>
          </Phone>
        </GuestView>
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════ 14 · calendar ═══ */

function CalendarAndGuestSchedule() {
  return (
    <>
      <Lede>
        Guests can put your events straight into the calendar on their phone, so
        the day shows up next to everything else in their life.
      </Lede>

      <Q q="What is it?">
        <p>
          A button on a guest&rsquo;s page that adds the events to Apple Calendar,
          Google Calendar, Outlook — whatever they already use. It carries only
          the events that guest can see.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because a wedding website is checked a handful of times and a calendar
          is checked every day. Once the ceremony is in their calendar with the
          venue attached, a guest is far less likely to arrive at the wrong place
          or the wrong hour.
        </p>
      </Q>

      <Q q="How does it work?">
        <p>
          There is nothing to switch on. Any event with a real date and start time
          is included automatically. Events with only a label — &ldquo;Late&rdquo;,
          &ldquo;After the ceremony&rdquo; — cannot go in a calendar and are left
          out, which is why giving events real times is worth the extra moment.
        </p>
        <Steps>
          <Step>Give each event a date and a start time on the schedule.</Step>
          <Step>Check the wedding&rsquo;s time zone is right.</Step>
          <Step>That is it — the button appears on every guest&rsquo;s page.</Step>
        </Steps>
        <Note title="Adding it twice is safe">
          If a guest taps it again after you have changed a time, their existing
          entries update rather than duplicating.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Calendar entries with the event name, the venue, the address and a link
          back to their page — at the right time for wherever they are. A guest
          flying in from another country sees the correct local hour without
          having to work anything out.
        </p>
      </Q>
    </>
  );
}

/* ═══════════════════════════════════════════ 15 · after publishing ═══ */

function ManagingYourPublishedWebsite() {
  return (
    <>
      <Lede>
        A published wedding is not frozen. Edit anything, whenever you like —
        changes are live immediately.
      </Lede>

      <Q q="What is it?">
        <p>
          The same wedding you built, now with a public address and working
          invitation links. Every page you used before still works the same way.
        </p>
      </Q>

      <Q q="Why would I use it?">
        <p>
          Because things change. A time moves, a venue changes room, a guest is
          added three weeks out. Being able to fix that in one place — and have
          every guest&rsquo;s page and calendar entry correct straight away — is
          most of the value of running the wedding here.
        </p>
      </Q>

      <Q q="How does it work?">
        <p><b>Changing details, events or seating</b></p>
        <p>
          Edit as normal. Guests see the change the next time they open their
          link, and calendar entries update when they refresh.
        </p>

        <p><b>Adding guests after invitations have gone out</b></p>
        <Steps>
          <Step>Add the guest as usual.</Step>
          <Step>Click <b>Send invitations</b> again.</Step>
          <Step>Only the new guest is emailed. Nobody is invited twice.</Step>
        </Steps>

        <p><b>Re-sending one invitation</b></p>
        <p>
          If a guest lost theirs or it went to spam, re-send just for them. This
          is limited to three times an hour per guest — enough to fix a bad
          address, not enough for a stuck button to send a hundred emails to one
          person.
        </p>

        <p><b>Taking it down</b></p>
        <p>
          <b>Unpublish</b> returns the wedding to a draft. The public address stops
          working and invitation links stop opening. Nothing is deleted, and you
          can publish again.
        </p>

        <Note tone="warn" title="Deleting is different">
          Deleting a wedding removes it and everything inside it — guests,
          replies, seating, photographs — permanently. If you only want it out of
          sight, unpublish instead.
        </Note>
      </Q>

      <Q q="What does the guest see?">
        <p>
          Whatever is true right now. There is no cached old version and no
          &ldquo;republish&rdquo; step to remember — a guest who opened their link
          last week and opens it again today sees today&rsquo;s schedule.
        </p>
      </Q>
    </>
  );
}

/* ══════════════════════════════════════════════════════ the registry ═══ */

export const HELP_BODIES: Record<string, () => React.JSX.Element> = {
  "creating-your-first-wedding": CreatingYourFirstWedding,
  "choosing-a-template": ChoosingATemplate,
  "adding-wedding-details": AddingWeddingDetails,
  "branding-your-wedding": BrandingYourWedding,
  "managing-guests": ManagingGuests,
  "creating-groups": CreatingGroups,
  "building-the-schedule": BuildingTheSchedule,
  seating: Seating,
  "photos-and-gallery": PhotosAndGallery,
  "registry-and-cash-gifts": RegistryAndCashGifts,
  rsvps: Rsvps,
  "publishing-your-wedding": PublishingYourWedding,
  "the-guest-experience": TheGuestExperience,
  "calendar-and-guest-schedule": CalendarAndGuestSchedule,
  "managing-your-published-website": ManagingYourPublishedWebsite,
};
