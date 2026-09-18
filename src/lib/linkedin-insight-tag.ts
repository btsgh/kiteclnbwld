// LinkedIn's Insight Tag loader for the team's own ad account. Kept in the
// template rather than @appsmithorg/template-frontend so it ships with the
// template instead of waiting on a package publish and a dependency bump. The
// upstream <noscript> pixel is omitted: LinkedIn reports a site as firing from
// the script's callback.
//
// Behaviour contract: linkedin-insight-tag.test.ts beside this file. Both
// Next.js templates carry this file byte for byte, locked by
// backend/tests/test_template_assets/test_linkedin_insight_tag_contract.py.

// ASCII digits only: the id is inlined into a script, so nothing else may reach it.
const LINKEDIN_PARTNER_ID_PATTERN = /^[0-9]+$/;

/** The loader for a partner id, or null for any value that is not all digits. */
export function linkedInInsightTagScript(
  partnerId: string | undefined,
): string | null {
  if (!partnerId || !LINKEDIN_PARTNER_ID_PATTERN.test(partnerId)) {
    return null;
  }
  return (
    `window._linkedin_partner_id=${JSON.stringify(partnerId)};` +
    'window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];' +
    'window._linkedin_data_partner_ids.push(window._linkedin_partner_id);' +
    '(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};' +
    'window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];' +
    'var b=document.createElement("script");b.type="text/javascript";b.async=true;' +
    'b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";' +
    's.parentNode.insertBefore(b,s)})(window.lintrk);'
  );
}
