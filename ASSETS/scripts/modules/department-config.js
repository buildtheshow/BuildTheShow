/* department-config.js - shared production department map */
(function () {
  'use strict';

  const TAB_LIST = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'planning', label: 'Planning' },
    { key: 'receipts', label: 'Receipts' },
  ];

  const GROUPS = [
    {
      key: 'front-of-house',
      label: 'Front of House',
      color: '#476aaa',
      icon: '/ASSETS/Images/Department-front-of-house.svg',
      sections: [
        section('ushers', 'Ushers', 'Audience welcome, seating, latecomers, accessibility support, and house flow.', ['Ushers', 'Usher']),
        section('concessions', 'Concessions', 'Snack table, sales float, food safety, stock, and end-of-night closeout.', ['Concessions', 'Concession Workers', 'Bakers']),
        section('box-office', 'Box Office', 'Ticket pickup, door sales, comp lists, payment questions, and check-in.', ['Box Office', 'Ticket Sales', 'Tickets']),
      ],
    },
    {
      key: 'backstage',
      label: 'Backstage & Rehearsal Support',
      color: '#dd8233',
      icon: '/ASSETS/Images/volunteer-backstage.svg',
      sections: [
        section('backstage-crew', 'Backstage Crew', 'Deck traffic, backstage readiness, entrances, exits, and show traffic.', ['Backstage Crew']),
        section('quick-changes', 'Quick Changes', 'Quick-change plots, dressing locations, change assistants, and timing notes.', ['Quick-Change Assistant', 'Quick Changes']),
        section('child-wrangling', 'Child Wrangling', 'Youth performer supervision, sign-in, waiting areas, and handoff notes.', ['Child Wrangler', 'Child Wrangling']),
        section('rehearsal-support', 'Rehearsal Support', 'Room setup, rehearsal helpers, attendance support, and director needs.', ['Rehearsal Assistant', 'Rehearsal Support']),
      ],
    },
    {
      key: 'technical',
      label: 'Technical Crew',
      color: '#d1523d',
      icon: '/ASSETS/Images/Department-technical.svg',
      sections: [
        section('lighting', 'Lighting', 'Lighting plan, focus notes, cues, spot needs, and equipment tracking.', ['Lighting', 'Lighting Crew', 'Lighting Designer / Technician']),
        section('sound', 'Sound', 'Playback, sound effects, board notes, monitors, and audio setup.', ['Sound', 'Sound Crew', 'Sound & Technical']),
        section('mics', 'Mics', 'Mic assignments, batteries, swaps, mic wrangling, and troubleshooting notes.', ['Mics', 'Mic Wrangler']),
        section('spotlight', 'Spotlight', 'Spot cues, operator assignments, followspot notes, and rehearsal tracking.', ['Spotlight', 'Spotlight Operators']),
      ],
    },
    {
      key: 'design-construction',
      label: 'Design & Construction',
      color: '#769e7b',
      icon: '/ASSETS/Images/Department-set.svg',
      sections: [
        section('set-building', 'Set Building', 'Build plans, materials, tools, safety notes, and construction progress.', ['Set Building', 'Set Builder', 'Set Builders', 'Lead Builder', 'Set Designer', 'Sets & Scenery', 'Set Construction', 'Set Strike Crew']),
        section('set-painting', 'Set Painting', 'Paint elevations, colour notes, finish samples, and scenic paint calls.', ['Set Painting', 'Set Painter', 'Set Painters', 'Lead Set Painter', 'Paint']),
        section('set-dressing', 'Set Dressing', 'Furniture, practicals, dressing lists, scene changes, and storage notes.', ['Set Dressing', 'Set Dresser']),
        section('props', 'Props', 'Prop lists, source status, hand props, consumables, and backstage placement.', ['Props', 'Props Helper', 'Lead Prop Person']),
      ],
    },
    {
      key: 'costumes',
      label: 'Costumes',
      color: '#3f7899',
      icon: '/ASSETS/Images/Department-costume-and-makeup.svg',
      tabs: [
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'costume-plan', label: 'Costume Plan' },
        { key: 'planning', label: 'Planning' },
        { key: 'receipts', label: 'Receipts' },
      ],
      sections: [
        section('costumes', 'Costumes', 'Costume plots, fittings, sourcing, repairs, approvals, and performer notes.', ['Costumes', 'Costume Designer', 'Costume Helper']),
        section('costume-laundry', 'Costume Laundry', 'Laundry schedule, care notes, garment bags, and wash volunteers.', ['Costume Laundry', 'Costume Washer', 'Laundry']),
        section('costume-move-out', 'Costume Move-Out', 'Returns, dry cleaning, storage, load-out, and post-show sorting.', ['Costume Move-Out', 'Costume Move Out Crew']),
      ],
    },
    {
      key: 'hair-makeup',
      label: 'Hair & Makeup',
      color: '#ca7ea7',
      icon: '/ASSETS/Images/Department-costume-and-makeup.svg',
      sections: [
        section('hair', 'Hair', 'Hair looks, performer hair notes, styling products, quick fixes, and call timing.', ['Hair', 'Hair Supplies', 'Styling Products']),
        section('makeup', 'Makeup', 'Makeup looks, allergies, sensitivities, product notes, and touch-up tracking.', ['Makeup']),
      ],
    },
    {
      key: 'marketing-publicity',
      label: 'Marketing & Publicity',
      color: '#efab45',
      icon: '/ASSETS/Images/Department-marketing.svg',
      sections: [
        section('branding', 'Branding', 'Show identity, key art, copy direction, and approved messaging.', ['Branding']),
        section('programme', 'Programme', 'Programme content, ads, credits, bios, proofing, and print readiness.', ['Programme', 'Programme Ads']),
        section('media', 'Media', 'Photos, video, social content, press assets, and release planning.', ['Media', 'Marketing Media']),
        section('sponsors', 'Sponsors', 'Sponsor commitments, ad packages, benefits, and recognition assets.', ['Sponsors', 'Sponsorship']),
        section('promotion-distribution', 'Promotion Distribution', 'Poster routes, flyer drops, community outreach, and promo tracking.', ['Promotion Distribution', 'Promo Distribution', 'Poster Distribution']),
      ],
    },
    {
      key: 'stage-management',
      label: 'Stage Management',
      color: '#572e88',
      icon: '/ASSETS/Images/volunteer-stage-manager.svg',
      sections: [
        section('stage-management', 'Stage Management', 'Calling, reports, rehearsal coordination, schedules, and show communication.', ['Stage Management', 'Stage Manager']),
      ],
    },
  ];

  function section(key, label, description, categoryAliases) {
    return {
      key,
      label,
      description,
      categoryAliases: categoryAliases || [label],
      notes: defaultNotes(label),
      planning: [
        'Confirm lead and point person',
        'Collect notes, files, and references',
        'Track purchases and receipts',
        'Review deadlines against the production calendar',
      ],
    };
  }

  function defaultNotes(label) {
    return [
      label + ' lead should confirm current priorities before the next call',
      'Keep purchases and receipts attached to this section',
      'Update files, references, and handoff notes as work changes',
      'Flag anything blocked before it affects rehearsal or performance',
    ];
  }

  function allSections() {
    return GROUPS.flatMap(function (group) {
      return group.sections.map(function (sectionConfig) {
        return Object.assign({ group: group }, sectionConfig);
      });
    });
  }

  function findGroup(key) {
    return GROUPS.find(function (group) { return group.key === key; }) || GROUPS[0];
  }

  function findSection(groupKey, sectionKey) {
    const group = findGroup(groupKey);
    return group.sections.find(function (sectionConfig) { return sectionConfig.key === sectionKey; }) || group.sections[0];
  }

  window.BTSDepartmentConfig = {
    tabs: TAB_LIST,
    groups: GROUPS,
    allSections,
    findGroup,
    findSection,
  };
})();
