import { Metadata } from 'next';
import { heroFont, bodyFont } from '@/app/fonts';

export const metadata: Metadata = {
  title: 'Contact | CleanBowled',
  description: 'Get in touch with us for delivery inquiries, pop-up partnerships, or nutritional questions.',
  alternates: { canonical: '/contact' },
  openGraph: {
    url: '/contact',
    title: 'Contact | CleanBowled',
    description: 'Get in touch with us for delivery inquiries, pop-up partnerships, or nutritional questions.',
    images: ['https://static.kite.ai/image/upload/f_auto,q_auto,w_1200/app/04a16de4-0fad-495e-9325-92907de26444/iter1/iter1-hero-main.png']
  }
};

export default function ContactPage() {
  return (
    <main className="bg-[#F9E0D5] min-h-screen pt-20">
      <section className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center mb-16">
          <span className={`${bodyFont.className} uppercase tracking-[0.2em] text-xs font-semibold mb-6 text-[#1A1A1A] block`}>
            CONTACT US
          </span>
          <h1 className={`${heroFont.className} text-5xl md:text-7xl leading-tight mb-8 text-[#1A1A1A]`}>
            We'd love to hear from you.
          </h1>
          <p className={`${bodyFont.className} text-lg text-[#1A1A1A]/80`}>
            Reach out for delivery support, retail partnerships, or any questions about our ingredients.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Location Info */}
          <div className="flex flex-col items-start bg-[#EDCABF] p-10 rounded-3xl">
            <h3 className={`${bodyFont.className} text-xl font-semibold text-[#1A1A1A] mb-6`}>Our Kitchen</h3>
            <p className={`${bodyFont.className} text-[#1A1A1A]/70 leading-relaxed mb-8`}>
              1200 Wellness Avenue<br />
              Suite 100<br />
              Los Angeles, CA 90015
            </p>
            
            <h3 className={`${bodyFont.className} text-xl font-semibold text-[#1A1A1A] mb-6`}>Pop-up Locations</h3>
            <p className={`${bodyFont.className} text-[#1A1A1A]/70 leading-relaxed mb-8`}>
              Follow us on Instagram to find out where our weekend pop-up shops will be stationed next.
            </p>

            <h3 className={`${bodyFont.className} text-xl font-semibold text-[#1A1A1A] mb-6`}>Hours</h3>
            <p className={`${bodyFont.className} text-[#1A1A1A]/70 leading-relaxed`}>
              Monday - Friday: 8am - 6pm<br />
              Saturday: 9am - 3pm (Pop-ups only)<br />
              Sunday: Closed
            </p>
          </div>

          {/* Contact Form */}
          <div>
            <form id="contact-form" className="flex flex-col gap-6">
              <div>
                <label htmlFor="name" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Name</label>
                <input type="text" id="name" name="name" required className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`} />
              </div>
              <div>
                <label htmlFor="email" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Email</label>
                <input type="email" id="email" name="email" required className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`} />
              </div>
              <div>
                <label htmlFor="subject" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Subject</label>
                <input type="text" id="subject" name="subject" required className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A]`} />
              </div>
              <div>
                <label htmlFor="message" className={`${bodyFont.className} block text-sm font-semibold text-[#1A1A1A] mb-2`}>Message</label>
                <textarea id="message" name="message" rows={5} required className={`${bodyFont.className} w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-[#1A1A1A] bg-transparent text-[#1A1A1A] resize-none`}></textarea>
              </div>
              <button type="submit" id="submit-btn" className={`${bodyFont.className} rounded-full bg-[#1A1A1A] text-white px-8 py-4 uppercase tracking-wider text-sm hover:bg-[#1A1A1A]/90 transition-colors w-full mt-2`}>
                Send Message
              </button>
              <p id="form-status" className={`${bodyFont.className} text-sm text-green-600 hidden mt-2 text-center`}>Message sent successfully!</p>
            </form>
            <script dangerouslySetInnerHTML={{ __html: `
              document.getElementById('contact-form').addEventListener('submit', function(e) {
                e.preventDefault();
                var btn = document.getElementById('submit-btn');
                var status = document.getElementById('form-status');
                var originalText = btn.innerText;
                btn.innerText = 'Sending...';
                btn.disabled = true;
                
                var fd = new FormData(this);
                fetch('/api/v1/kite-platform/contact-form/submit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    email: fd.get('email'),
                    subject: fd.get('subject'),
                    json_body: Object.fromEntries(fd)
                  })
                }).then(function(res) {
                  if(res.ok) {
                    status.classList.remove('hidden');
                    document.getElementById('contact-form').reset();
                  } else {
                    alert('There was an error sending your message.');
                  }
                }).catch(function() {
                  alert('There was an error sending your message.');
                }).finally(function() {
                  btn.innerText = originalText;
                  btn.disabled = false;
                });
              });
            `}} />
          </div>
        </div>
      </section>
    </main>
  );
}
