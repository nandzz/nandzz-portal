import { COMPANY as C, GARANTE_URL, MIN_AGE } from "../company";
import { A, B, H3, Mail, P, Summary, Table, Ul } from "../components/primitives";
import { SubprocessorTable } from "../components/SubprocessorTable";
import type { LegalDocument } from "../types";

export const privacyIt: LegalDocument = {
  title: "Informativa sulla privacy",
  subtitle:
    "Come Nandzz raccoglie e usa i dati personali e quali diritti hai. Riguarda titolari di account, visitatori e chi prenota tramite una pagina Nandzz (artt. 13-14 GDPR).",
  intro: (
    <Summary title="In breve">
      <Ul>
        <li>Raccogliamo solo i dati necessari per far funzionare Nandzz, gestire i pagamenti, garantire la sicurezza e adempiere ai nostri obblighi di legge.</li>
        <li>Non vendiamo i tuoi dati, non mostriamo pubblicità e non usiamo cookie di tracciamento. Le statistiche sui visitatori sono anonime e non usano cookie.</li>
        <li>
          Se prenoti presso un&apos;attività tramite Nandzz, <B>i tuoi dati sono gestiti da quell&apos;attività</B>.
          Noi li trattiamo per suo conto.
        </li>
        <li>
          Puoi accedere ai tuoi dati, correggerli, esportarli e cancellarli. Puoi anche scriverci a{" "}
          <Mail to={C.emails.privacy} />.
        </li>
      </Ul>
    </Summary>
  ),
  sections: [
    {
      id: "controller",
      title: "Titolare del trattamento",
      body: (
        <>
          <P>
            Il titolare del trattamento è <B>{C.legalName}</B>, {C.registeredOffice}, P.IVA {C.vatNumber}. Puoi
            contattarci a <Mail to={C.emails.privacy} /> o via PEC a {C.pec}.
          </P>
          <P>
            Non abbiamo nominato un Responsabile della protezione dei dati (DPO), perché per le nostre attività
            la legge non lo richiede. Le tue richieste sono gestite direttamente da chi si occupa della privacy.
          </P>
          <P>
            <B>Prenotazioni e chat IA sulla pagina di un&apos;attività.</B> Ogni attività che usa Nandzz è
            titolare dei dati dei propri clienti. Noi agiamo come suo <B>responsabile del trattamento</B> (art.
            28 GDPR, vedi il nostro <A href="/dpa">DPA</A>). Questo vale per:
          </P>
          <Ul>
            <li>le prenotazioni che effettui sulla pagina di un&apos;attività</li>
            <li>i messaggi che invii al suo agente IA</li>
          </Ul>
          <P>
            Per le richieste su quei dati, rivolgiti direttamente all&apos;attività: la aiuteremo a risponderti.
            La sezione 4 spiega questo punto nel dettaglio.
          </P>
        </>
      ),
    },
    {
      id: "what-we-collect",
      title: "Quali dati trattiamo, perché e su quale base giuridica",
      body: (
        <>
          <P>
            La tabella elenca ogni attività di trattamento ai sensi del GDPR (Regolamento (UE) 2016/679), con i
            dati usati, la base giuridica (art. 6 GDPR) e il periodo di conservazione.
          </P>
          <Table
            head={["Attività", "Dati", "Base giuridica", "Conservazione"]}
            rows={[
              [
                <B key="a">Account e accesso</B>,
                "Email, password (cifrata), username, nome visualizzato, nome, email e avatar dell'account Google se usi l'accesso con Google, numero di telefono se lo verifichi",
                "Contratto (art. 6.1.b)",
                "Finché l'account esiste. Cancellati entro 30 giorni dalla chiusura dell'account.",
              ],
              [
                <B key="a">Pagina pubblica e contenuti</B>,
                "Dati del profilo, bio, avatar, branding, indirizzo dell'attività, contenuti pubblicati, link, galleria, commenti, like e follower",
                "Contratto (art. 6.1.b)",
                "Fino alla cancellazione da parte tua o alla chiusura dell'account",
              ],
              [
                <B key="a">Pagamenti e fatturazione</B>,
                "Nome, email, indirizzo di fatturazione, piano, transazioni, storico dei crediti. I dati della carta restano a Stripe.",
                "Contratto; obbligo di legge in materia fiscale e contabile (art. 6.1.c)",
                "10 anni (art. 2220 c.c.)",
              ],
              [
                <B key="a">Email e messaggi di servizio</B>,
                "Email o numero di telefono, contenuto del messaggio",
                "Contratto; legittimo interesse per gli avvisi di sicurezza",
                "Log di invio per 24 mesi",
              ],
              [
                <B key="a">Statistiche visitatori senza cookie</B>,
                "Hash irreversibile di indirizzo IP, user-agent del browser e data, che cambia ogni giorno. Gli indirizzi IP non vengono mai salvati in chiaro. Se hai effettuato l'accesso, si usa invece il tuo ID utente.",
                "Legittimo interesse (art. 6.1.f): mostrare ai titolari delle pagine quante persone le visitano",
                "13 mesi",
              ],
              [
                <B key="a">Sicurezza e prevenzione abusi</B>,
                "Indirizzo IP, log delle richieste e degli accessi, contatori anti-abuso",
                "Legittimo interesse: protezione del servizio",
                "Fino a 90 giorni, salvo necessità di indagine",
              ],
              [
                <B key="a">Funzioni di IA che usi</B>,
                "Istruzioni e contenuti inviati all'editor IA",
                "Contratto",
                "Non conservati da noi oltre il risultato del lavoro. Il fornitore li conserva fino a 30 giorni per il monitoraggio degli abusi.",
              ],
              [
                <B key="a">Assistenza e modulo di contatto</B>,
                "Nome, email, il tuo messaggio",
                "Legittimo interesse a risponderti; contratto se riguarda il tuo account",
                "Fino a 24 mesi dalla fine della conversazione",
              ],
              [
                <B key="a">Segnalazioni di contenuti (DSA)</B>,
                "URL segnalato, motivo, nome ed email se forniti",
                "Obbligo di legge (art. 16 DSA)",
                "24 mesi",
              ],
              [
                <B key="a">Registro di accettazione dei Termini</B>,
                "Versione accettata e data e ora",
                "Obbligo di legge e legittimo interesse a dimostrare consenso e accettazione",
                "Finché l'account esiste",
              ],
            ]}
          />
          <P>
            Non usiamo i tuoi dati per pubblicità, profilazione o decisioni automatizzate che producano effetti
            giuridici o altrettanto significativi (art. 22 GDPR). Non usiamo i tuoi contenuti né i dati dei tuoi
            clienti per addestrare modelli di IA.
          </P>
          <P>
            I dati dell&apos;account e di pagamento sono necessari per usare le relative funzioni. Tutti gli
            altri dati sono facoltativi.
          </P>
        </>
      ),
    },
    {
      id: "legitimate-interests",
      title: "Opposizione al trattamento basato sul legittimo interesse",
      body: (
        <P>
          Quando ci basiamo sul legittimo interesse, lo abbiamo bilanciato con i tuoi diritti. Riduciamo i dati
          al minimo, ad esempio con un hash dei dati dei visitatori che cambia ogni giorno. Puoi opporti in
          qualsiasi momento scrivendo a <Mail to={C.emails.privacy} />. Ci fermeremo, salvo motivi legittimi
          cogenti o la necessità dei dati per esercitare o difendere un diritto in sede giudiziaria.
        </P>
      ),
    },
    {
      id: "bookings",
      title: "Se prenoti tramite una pagina Nandzz",
      body: (
        <>
          <P>
            Quando prenoti un appuntamento o chatti con un agente IA sulla pagina Nandzz di un&apos;attività,
            l&apos;attività raccoglie i seguenti dati, che il suo personale può vedere:
          </P>
          <Ul>
            <li>nome e numero di telefono</li>
            <li>email, se la fornisci</li>
            <li>indirizzo, se l&apos;attività lo richiede</li>
            <li>le tue note</li>
            <li>i dettagli dell&apos;appuntamento</li>
            <li>i messaggi in chat</li>
          </Ul>
          <P>
            <B>L&apos;attività è titolare del trattamento</B> e Nandzz tratta i dati per suo conto. Si applica la
            sua informativa. Per esercitare i tuoi diritti rivolgiti direttamente all&apos;attività.
          </P>
          <P>Per conto dell&apos;attività noi:</P>
          <Ul>
            <li>conserviamo la prenotazione</li>
            <li>inviamo email di conferma, modifica e promemoria</li>
            <li>
              inviamo un promemoria WhatsApp tramite Twilio, <B>solo se selezioni la casella</B>. Per
              interrompere i promemoria in seguito, rivolgiti all&apos;attività.
            </li>
            <li>generiamo le risposte della chat IA tramite OpenAI. Non conserviamo i messaggi dopo l&apos;invio della risposta.</li>
          </Ul>
          <P>
            I dati del cliente sono anonimizzati automaticamente 24 mesi dopo l&apos;appuntamento, o prima se
            l&apos;attività li cancella o chiude l&apos;account.
          </P>
          <P>
            Se prenoti dopo aver effettuato l&apos;accesso al tuo account Nandzz, colleghiamo anche la
            prenotazione al tuo account, così puoi gestirla. Per questo collegamento siamo titolari, e la base
            giuridica è il contratto.
          </P>
        </>
      ),
    },
    {
      id: "sharing",
      title: "A chi comunichiamo i dati",
      body: (
        <>
          <P>Non vendiamo né affittiamo dati personali. Li comunichiamo solo a:</P>
          <Ul>
            <li>
              <B>Fornitori di servizi (responsabili del trattamento)</B> che ci aiutano a gestire Nandzz,
              vincolati per contratto alle nostre istruzioni. Sono elencati qui sotto.
            </li>
            <li>
              <B>Attività presso cui prenoti</B>, che ricevono i dati della prenotazione che inserisci.
            </li>
            <li>
              <B>Il pubblico</B>, per i contenuti che scegli di pubblicare sulla tua pagina.
            </li>
            <li>
              <B>Autorità</B>, quando la legge lo impone o per tutelare diritti e sicurezza.
            </li>
            <li>
              <B>Un acquirente o successore</B>, in caso di fusione o cessione di Nandzz. Sarà vincolato a questa
              informativa, e ti avviseremo prima.
            </li>
          </Ul>
          <H3>Sub-responsabili</H3>
          <SubprocessorTable locale="it" />
        </>
      ),
    },
    {
      id: "transfers",
      title: "Trasferimenti extra-UE",
      body: (
        <>
          <P>
            Il nostro database principale è ospitato nell&apos;UE. Alcuni fornitori della tabella hanno sede
            negli Stati Uniti o possono accedere ai dati da lì. Quando i dati escono dall&apos;UE/SEE usiamo
            queste garanzie:
          </P>
          <Ul>
            <li>
              l&apos;EU–US Data Privacy Framework, per i destinatari certificati (decisione di adeguatezza, art.
              45 GDPR)
            </li>
            <li>
              le Clausole Contrattuali Standard della Commissione europea (art. 46 GDPR), con misure
              supplementari ove necessario
            </li>
          </Ul>
          <P>
            Puoi chiederci una copia di queste garanzie.
          </P>
        </>
      ),
    },
    {
      id: "security",
      title: "Sicurezza",
      body: (
        <>
          <P>Proteggiamo i dati con:</P>
          <Ul>
            <li>cifratura in transito (TLS) e a riposo</li>
            <li>controlli di accesso a livello di riga nel database</li>
            <li>accessi del personale limitati allo stretto necessario</li>
            <li>password cifrate</li>
            <li>visualizzazione isolata (sandbox) dei contenuti web caricati dagli utenti</li>
          </Ul>
          <P>
            Nessun sistema è perfettamente sicuro. Se una violazione può metterti a rischio, la notificheremo a
            te e all&apos;autorità competente come previsto dalla legge.
          </P>
        </>
      ),
    },
    {
      id: "rights",
      title: "I tuoi diritti",
      body: (
        <>
          <P>Ai sensi degli artt. 15-21 GDPR hai il diritto di:</P>
          <Ul>
            <li><B>accedere</B> ai tuoi dati e riceverne copia</li>
            <li><B>rettificare</B> i dati inesatti. Gran parte puoi modificarli da solo nelle Impostazioni.</li>
            <li><B>cancellare</B> i tuoi dati. Elimina l&apos;account dalle Impostazioni o chiedilo a noi.</li>
            <li><B>limitare</B> il trattamento in alcuni casi</li>
            <li>
              <B>portabilità</B>. Usa &quot;Scarica i miei dati&quot; nelle Impostazioni per ottenere un file
              JSON leggibile da una macchina.
            </li>
            <li><B>opporti</B> al trattamento basato sul legittimo interesse (sezione 3)</li>
            <li><B>revocare il consenso</B> in qualsiasi momento, senza effetto sui trattamenti precedenti</li>
          </Ul>
          <P>
            Scrivi a <Mail to={C.emails.privacy} />. Rispondiamo entro un mese. Nei casi complessi il termine può
            essere esteso di altri due mesi, e in tal caso ti avviseremo. Potremmo chiederti di confermare la tua
            identità.
          </P>
          <P>
            Hai anche il diritto di proporre reclamo al{" "}
            <A href={GARANTE_URL}>Garante per la protezione dei dati personali</A> o all&apos;autorità del paese
            in cui vivi o lavori.
          </P>
        </>
      ),
    },
    {
      id: "children",
      title: "Minori",
      body: (
        <P>
          Nandzz non è destinato ai minori di {MIN_AGE} anni, che non possono creare un account. Se ritieni che
          un minore di {MIN_AGE} anni ci abbia fornito dati personali, contattaci e li cancelleremo.
        </P>
      ),
    },
    {
      id: "cookies",
      title: "Cookie",
      body: (
        <P>
          Usiamo solo cookie e strumenti di archiviazione tecnicamente necessari, quindi non serve un banner di
          consenso. L&apos;elenco completo è nella <A href="/cookies">Cookie policy</A>.
        </P>
      ),
    },
    {
      id: "us-uk",
      title: "Informazioni aggiuntive per Regno Unito e Stati Uniti",
      body: (
        <>
          <P>
            <B>Regno Unito.</B> Lo UK GDPR ti riconosce gli stessi diritti. Puoi proporre reclamo
            all&apos;Information Commissioner&apos;s Office (ico.org.uk). I trasferimenti dal Regno Unito usano
            l&apos;UK Addendum alle Clausole Contrattuali Standard o lo UK–US data bridge.
          </P>
          <P>
            <B>California e altri stati USA.</B> Negli ultimi 12 mesi abbiamo raccolto le categorie descritte
            nella sezione 2:
          </P>
          <Ul>
            <li>identificativi</li>
            <li>informazioni commerciali</li>
            <li>attività su internet</li>
            <li>contenuti degli utenti</li>
          </Ul>
          <P>
            Le abbiamo usate per gli scopi descritti sopra. <B>Non vendiamo</B> informazioni personali. Non le{" "}
            <B>condividiamo</B> per pubblicità comportamentale. Non usiamo informazioni sensibili per dedurre
            caratteristiche personali.
          </P>
          <P>
            Puoi chiedere di conoscere, correggere o cancellare le tue informazioni tramite i contatti sopra. Non
            subirai discriminazioni per aver esercitato questi diritti. Un agente autorizzato può presentare una
            richiesta per tuo conto, con prova della delega.
          </P>
        </>
      ),
    },
    {
      id: "changes",
      title: "Modifiche a questa informativa",
      body: (
        <P>
          Aggiorniamo questa informativa quando cambiano i nostri trattamenti. Per le modifiche rilevanti ti
          avviseremo nell&apos;app o via email prima che si applichino. La data in alto indica la versione
          corrente.
        </P>
      ),
    },
  ],
};
